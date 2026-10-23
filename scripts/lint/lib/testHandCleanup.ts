#!/usr/bin/env bun
// Finds row cleanup in test cleanup hooks (beforeEach/afterEach/afterAll, test.afterEach included) by
// parsing each file, so comments never match and a delete that is the subject of a test body is outside
// every hook. A hook passed a function by name, or calling a helper, is judged by that function.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
const SCHEMA_DIR = join(REPO_ROOT, 'packages/db/prisma/schema');
// cleanupTouchedTables is the sanctioned cleanup; its own DELETE is not hand cleanup.
const TRACKER = join(REPO_ROOT, 'packages/db/src/test/testTracker.ts');
const MODEL_DECLARATION = /^\s*model\s+(\w+)\s*\{/gm;
const CLEANUP_HOOKS = new Set(['beforeEach', 'afterEach', 'afterAll']);
const ROW_DELETES = new Set(['delete', 'deleteMany']);
const RAW_SQL = new Set(['$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe']);
// DROP TABLE is schema teardown of a table the test created, and is allowed.
const SQL_ROW_CLEANUP = /\bTRUNCATE\b|\bDELETE\s+FROM\b/i;

type Violation = { file: string; line: number; text: string; via?: string };

type Declaration = { node: ts.Node; source: ts.SourceFile };

// A .delete/.deleteMany counts only on a Prisma delegate, so Map.delete or cache.delete is left alone.
export const modelDelegates = (schemaDir: string = SCHEMA_DIR): Set<string> => {
  const delegates = new Set<string>();
  for (const entry of readdirSync(schemaDir, { recursive: true }) as string[]) {
    if (!entry.endsWith('.prisma')) continue;
    for (const match of readFileSync(join(schemaDir, entry), 'utf8').matchAll(MODEL_DECLARATION)) {
      const model = match[1] as string;
      delegates.add(model[0]?.toLowerCase() + model.slice(1));
    }
  }
  return delegates;
};

const sources = new Map<string, ts.SourceFile>();

const parse = (file: string): ts.SourceFile => {
  const cached = sources.get(file);
  if (cached) return cached;
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  sources.set(file, source);
  return source;
};

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const calleeName = (callee: ts.Expression): string | undefined => {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
};

const compilerOptionsByConfig = new Map<string, ts.CompilerOptions>();

const compilerOptionsFor = (file: string): ts.CompilerOptions => {
  const config = ts.findConfigFile(dirname(file), ts.sys.fileExists);
  if (!config) return {};
  const cached = compilerOptionsByConfig.get(config);
  if (cached) return cached;
  const { config: raw } = ts.readConfigFile(config, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(raw, ts.sys, dirname(config));
  compilerOptionsByConfig.set(config, options);
  return options;
};

// The rule polices test code deleting rows; production code deleting rows is doing its job, and a hook
// that registers a db hook must not be judged by what that db hook does later.
const TEST_CODE = /\.test\.tsx?$|(^|\/)tests?\//;

// Resolved the way the compiler does (nearest tsconfig's paths), so @template/* aliases land on the same
// file a relative import would. Only test code is followed.
const resolveImport = (from: string, specifier: string): string | undefined => {
  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    from,
    compilerOptionsFor(from),
    ts.sys,
  );
  const file = resolvedModule?.resolvedFileName;
  if (!file || !TEST_CODE.test(file) || file.includes('/node_modules/') || !/\.tsx?$/.test(file))
    return undefined;
  return file;
};

// A name resolves to the function bound to it in the same file, or to a named import.
const findDeclaration = (source: ts.SourceFile, name: string): Declaration | undefined => {
  let found: Declaration | undefined;
  let imported: { file: string; name: string } | undefined;

  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      found = { node: node.initializer, source };
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) {
      found = { node: node.body, source };
      return;
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        const binding = bindings.elements.find((element) => element.name.text === name);
        const file = binding && resolveImport(source.fileName, node.moduleSpecifier.text);
        if (binding && file) imported = { file, name: (binding.propertyName ?? binding.name).text };
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  if (found || !imported) return found;
  return findDeclaration(parse(imported.file), imported.name);
};

const scanForCleanup = (
  start: Declaration,
  delegates: Set<string>,
  visited: Set<ts.Node>,
): { node: ts.Node; source: ts.SourceFile } | undefined => {
  if (visited.has(start.node) || resolve(start.source.fileName) === TRACKER) return undefined;
  visited.add(start.node);

  const { source } = start;
  let hit: { node: ts.Node; source: ts.SourceFile } | undefined;

  const follow = (name: string) => {
    const declaration = findDeclaration(source, name);
    if (declaration) hit ??= scanForCleanup(declaration, delegates, visited);
  };

  const visit = (node: ts.Node) => {
    if (hit) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        const owner = callee.expression;
        if (
          ROW_DELETES.has(method) &&
          ts.isPropertyAccessExpression(owner) &&
          delegates.has(owner.name.text)
        ) {
          hit = { node, source };
          return;
        }
        if (
          RAW_SQL.has(method) &&
          node.arguments.some((arg) => SQL_ROW_CLEANUP.test(arg.getText(source)))
        ) {
          hit = { node, source };
          return;
        }
      }
      if (ts.isIdentifier(callee)) follow(callee.text);
    }
    if (
      ts.isTaggedTemplateExpression(node) &&
      RAW_SQL.has(calleeName(node.tag) ?? '') &&
      SQL_ROW_CLEANUP.test(node.template.getText(source))
    ) {
      hit = { node, source };
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(start.node);

  return hit;
};

export const findHandCleanup = (file: string, delegates: Set<string>): Violation[] => {
  const source = parse(file);
  const violations: Violation[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && CLEANUP_HOOKS.has(calleeName(node.expression) ?? '')) {
      const callback = node.arguments[0];
      const start: Declaration | undefined = !callback
        ? undefined
        : ts.isIdentifier(callback)
          ? findDeclaration(source, callback.text)
          : { node: callback, source };
      const hit = start && scanForCleanup(start, delegates, new Set());
      if (hit) {
        const elsewhere =
          hit.source !== source || hit.node.pos < node.pos || hit.node.end > node.end;
        violations.push({
          file,
          line: lineOf(source, node),
          text: hit.node.getText(hit.source).split('\n')[0]?.trim() ?? '',
          via: elsewhere ? `${hit.source.fileName}:${lineOf(hit.source, hit.node)}` : undefined,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return violations;
};

if (import.meta.main) {
  const delegates = modelDelegates();
  const violations = process.argv.slice(2).flatMap((file) => findHandCleanup(file, delegates));

  if (violations.length) {
    const lines = violations.map(
      (v) =>
        `${v.file}:${v.line}: ${v.text}${v.via ? ` (in ${relative(process.cwd(), v.via)})` : ''}`,
    );
    process.stdout.write(
      'Found hand cleanup in a test cleanup hook (afterEach, afterAll, beforeEach).\n' +
        'The test tracker records every table a test writes and cleanupTouchedTables() clears them,\n' +
        'so call cleanupTouchedTables(db) instead of deleting rows yourself. If a write genuinely escapes\n' +
        'the tracker (raw SQL), make that write visible to the tracker instead.\n\n' +
        `${lines.join('\n')}\n`,
    );
    process.exit(1);
  }
}
