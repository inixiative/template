#!/usr/bin/env bun
/**
 * Detector for the entitlement-writer-only CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/entitlementWriterOnly.ts
 *
 * Entitlement rows are written by one writer, `changeEntitlements`
 * (apps/api/src/lib/permissions/changeEntitlements.ts), and the grant check lives inside it
 * (docs/claude/PERMISSIONS.md, Changing Entitlements). A write anywhere else is a second door the
 * check does not stand in. Fails, outside the writer and tests, on:
 * - a write method on the entitlement delegate, however it is reached: `db.entitlement.create`,
 *   `db['entitlement']['deleteMany']`, `delegate('Entitlement')` (or a const holding the name), an
 *   alias (`const e = db.entitlement`) or a destructured `{ entitlement }`;
 * - a nested write through any relation to Entitlement (a property ending in `Entitlement` or
 *   `Entitlements`: `targetEntitlements: { create }`, `sourceEntitlement: { connect }`), or such a
 *   relation handed a variable inside `data`;
 * - `model: 'Entitlement'` in an object literal, the way generic machinery (an edge table) names
 *   the model it writes through `delegate(<variable>)`.
 * Reads are free. An exception goes in scripts/ci/entitlement-writer-only/exempt.txt as
 * `<file>:<key>\t<reason>`: a write the system makes from the schema, never one a caller asks for.
 * Not seen: a model name that arrives at run time (the cascade's parent/child registry, a
 * hardDeleteRecordsPastRetention cron payload) and raw SQL; PERMISSIONS.md names them.
 */
import ts from 'typescript';
import {
  applyExemptionsAndBaselineThenExit,
  isTestFile,
  lineAt,
  listFiles,
  readExemptions,
  readSource,
  type Violation,
} from './ciRuleRunner';

const WRITER = 'apps/api/src/lib/permissions/changeEntitlements.ts';
const WRITE_METHODS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);
const NESTED_WRITES = new Set([
  ...WRITE_METHODS,
  'connect',
  'connectOrCreate',
  'disconnect',
  'set',
]);
const RELATION = /Entitlements?$/;
const MODEL = 'Entitlement';

const exemptions = readExemptions('entitlement-writer-only');
const usedExemptions = new Set<string>();
const violations: Violation[] = [];

const nameOf = (node: ts.PropertyName | ts.MemberName, sourceFile: ts.SourceFile): string =>
  ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isPrivateIdentifier(node)
    ? node.text
    : node.getText(sourceFile);

// The member a property or element access reads: `x.name`, `x?.name`, `x['name']`.
const memberName = (node: ts.Node): string | undefined => {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression))
    return node.argumentExpression.text;
  return undefined;
};

const memberObject = (node: ts.Node): ts.Expression | undefined =>
  ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
    ? node.expression
    : undefined;

const isRelationName = (name: string): boolean => name !== 'entitlement' && RELATION.test(name);

for (const file of listFiles(['apps', 'packages'], /\.tsx?$/)) {
  if (file === WRITER || isTestFile(file) || file.endsWith('.d.ts')) continue;
  const source = readSource(file);
  if (!/[Ee]ntitlement/.test(source)) continue;
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  // Names bound in this file to the model name, and to the delegate itself.
  const modelNames = new Set<string>();
  const aliases = new Set<string>();

  const namesModel = (node: ts.Expression): boolean =>
    (ts.isStringLiteralLike(node) && node.text === MODEL) ||
    (ts.isIdentifier(node) && modelNames.has(node.text));

  const isDelegate = (node: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))
      return isDelegate(node.expression);
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
      return isDelegate(node.expression);
    if (ts.isIdentifier(node)) return aliases.has(node.text);
    if (memberName(node) === 'entitlement') return true;
    if (ts.isCallExpression(node) && memberName(node.expression) === 'delegate') {
      const [argument] = node.arguments;
      return argument !== undefined && namesModel(argument);
    }
    return false;
  };

  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) {
        if (ts.isStringLiteralLike(node.initializer) && node.initializer.text === MODEL)
          modelNames.add(node.name.text);
        else if (isDelegate(node.initializer)) aliases.add(node.name.text);
      } else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const property = element.propertyName ?? element.name;
          if (
            ts.isIdentifier(element.name) &&
            (ts.isIdentifier(property) || ts.isStringLiteralLike(property)) &&
            property.text === 'entitlement'
          )
            aliases.add(element.name.text);
        }
      }
    }
    ts.forEachChild(node, collect);
  };
  // Twice, so an alias of an alias declared later in the file is known before the check.
  collect(sourceFile);
  collect(sourceFile);

  const fileViolations: Violation[] = [];
  const flag = (node: ts.Node, key: string, detail: string) =>
    fileViolations.push({ file, line: lineAt(source, node.getStart(sourceFile)), key, detail });

  const insideData = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent; parent = parent.parent)
      if (ts.isPropertyAssignment(parent) && nameOf(parent.name, sourceFile) === 'data')
        return true;
    return false;
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const method = memberName(node.expression);
      const object = memberObject(node.expression);
      if (method && WRITE_METHODS.has(method) && object && isDelegate(object))
        flag(
          node,
          `entitlement.${method}`,
          `writes entitlement rows: \`${node.expression.getText(sourceFile)}\``,
        );
    }
    if (
      ts.isPropertyAssignment(node) &&
      nameOf(node.name, sourceFile) === 'model' &&
      namesModel(node.initializer)
    )
      flag(
        node,
        "model: 'Entitlement'",
        'names Entitlement for generic machinery that writes the model it is handed',
      );
    if (ts.isPropertyAssignment(node) && isRelationName(nameOf(node.name, sourceFile))) {
      const relation = nameOf(node.name, sourceFile);
      if (ts.isObjectLiteralExpression(node.initializer)) {
        for (const property of node.initializer.properties) {
          if (!property.name) continue;
          const method = nameOf(property.name, sourceFile);
          if (NESTED_WRITES.has(method))
            flag(
              property,
              `${relation}.${method}`,
              `nested entitlement write \`${relation}: { ${method} }\``,
            );
        }
      } else if (insideData(node))
        flag(node, `${relation}.data`, `nested entitlement write \`${relation}\` inside \`data\``);
    }
    if (
      ts.isShorthandPropertyAssignment(node) &&
      isRelationName(node.name.text) &&
      insideData(node)
    )
      flag(
        node,
        `${node.name.text}.data`,
        `nested entitlement write \`${node.name.text}\` inside \`data\``,
      );
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const violation of fileViolations) {
    const key = `${file}:${violation.key}`;
    if (exemptions.has(key)) usedExemptions.add(key);
    else violations.push(violation);
  }
}

applyExemptionsAndBaselineThenExit({
  rule: 'entitlement-writer-only',
  violations,
  usedExemptions,
  failureExplanationLines: [
    'Entitlement rows written outside the one writer. Go through it, so the grant check runs:',
    "  import { changeEntitlements } from '#/lib/permissions/changeEntitlements';",
    "  await changeEntitlements(c.get('permix'), { model, id }, { add, remove });",
    'A gap in the check is fixed inside the writer, never beside it.',
  ],
  passMessage: 'Entitlement rows are written only by changeEntitlements.',
});
