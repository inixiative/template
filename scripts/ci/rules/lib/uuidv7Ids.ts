#!/usr/bin/env bun
/**
 * Detector for the uuidv7-ids CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/uuidv7Ids.ts [--write-baseline]
 *
 * Every Prisma model's primary key is exactly
 *   id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
 * (attribute order free). Fails on a model with no such field: a v4 `uuid()`/`cuid()` default, a
 * different type or length, an id under another name, or a composite `@@id`. Why: v7 ids are
 * time-ordered, and `paginate()`'s `{ id: desc }` tiebreaker and every cursor depend on that.
 *
 * Code mints the same: a call to `randomUUID()` / `crypto.randomUUID()` in apps/ or packages/ (tests
 * included) fails; use `Bun.randomUUIDv7()` (the `uuidv7` package where Bun's globals are absent).
 * A secret that is not an id goes in scripts/ci/uuidv7-ids/exempt.txt as `<file>\t<reason>`.
 */
import ts from 'typescript';
import {
  applyExemptionsAndBaselineThenExit,
  fetchExemptions,
  fetchSource,
  lineAt,
  listFiles,
  type Violation,
} from './ciRuleRunner';
import { readPrismaModels } from './schemaSources';

const REQUIRED = ['@id', '@default(dbgenerated("uuidv7()"))', '@db.VarChar(36)'];

const attributesOf = (rest: string): string[] => {
  const attributes: string[] = [];
  let i = 0;
  while (i < rest.length) {
    if (rest[i] !== '@') {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rest.length && /[\w.@]/.test(rest[j])) j++;
    if (rest[j] === '(') {
      let depth = 0;
      for (; j < rest.length; j++) {
        if (rest[j] === '(') depth++;
        else if (rest[j] === ')' && --depth === 0) {
          j++;
          break;
        }
      }
    }
    attributes.push(rest.slice(i, j).replace(/\s+/g, ''));
    i = j;
  }
  return attributes;
};

const exemptions = fetchExemptions('uuidv7-ids');
const usedExemptions = new Set<string>();
const violations: Violation[] = [];

for (const { file, source, name: model, body, offset: modelOffset, bodyOffset } of readPrismaModels(
  ['apps', 'packages'],
)) {
  const report = (offset: number, detail: string) =>
    violations.push({
      file,
      line: lineAt(source, offset),
      key: model,
      detail: `${model}: ${detail}`,
    });

  if (/^\s*@@id\b/m.test(body)) {
    report(
      bodyOffset + body.search(/@@id\b/),
      'composite @@id; give it a uuidv7 id and a @@unique',
    );
    continue;
  }
  const fields = [...body.matchAll(/^[ \t]*(\w+)[ \t]+(\S+)([^\n]*)$/gm)].filter(
    (f) => !f[1].startsWith('@@'),
  );
  const idField = fields.find((f) => attributesOf(f[3].replace(/\/\/.*$/, '')).includes('@id'));
  if (!idField) {
    report(modelOffset, 'no @id field');
    continue;
  }
  const attributes = attributesOf(idField[3].replace(/\/\/.*$/, ''));
  const missing = REQUIRED.filter((a) => !attributes.includes(a));
  const offset = bodyOffset + (idField.index ?? 0);
  if (idField[1] !== 'id' || idField[2] !== 'String' || missing.length > 0)
    report(
      offset,
      `id must be \`id String ${REQUIRED.join(' ')}\` (found \`${idField[0].trim().replace(/\s+/g, ' ')}\`)`,
    );
}

for (const file of listFiles(['apps', 'packages'], /\.tsx?$/)) {
  if (file.endsWith('.d.ts')) continue;
  const source = fetchSource(file);
  if (!source.includes('randomUUID')) continue;
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fileViolations: Violation[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : '';
      if (name === 'randomUUID')
        fileViolations.push({
          file,
          line: lineAt(source, node.getStart(sourceFile)),
          key: callee.getText(sourceFile),
          detail: `${callee.getText(sourceFile)}() mints a v4; use Bun.randomUUIDv7() (uuidv7 where Bun is absent)`,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (fileViolations.length === 0) continue;
  if (exemptions.has(file)) usedExemptions.add(file);
  else violations.push(...fileViolations);
}

applyExemptionsAndBaselineThenExit({
  rule: 'uuidv7-ids',
  violations,
  usedExemptions,
  failureExplanationLines: [
    'Prisma models without a uuidv7 primary key (every model id is:',
    '  id String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)',
    ') and code that mints ids with randomUUID(): use Bun.randomUUIDv7().',
  ],
  passMessage: 'Every Prisma model id is a uuidv7 VarChar(36), and no code mints a v4.',
});
