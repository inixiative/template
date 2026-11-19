#!/usr/bin/env bun
/**
 * Detector for the set-null-arm-requires-dual-polymorphism-id CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/setNullArmRequiresDualPolymorphismId.ts
 *
 * A relation on a false-polymorphic axis whose typed foreign key is `onDelete: SetNull`, to a model that
 * can be hard-deleted, must sit on an axis registered with a `dualPolymorphismId` plain id column
 * (packages/db/src/registries/falsePolymorphism.ts), as Entitlement's `sourceId` is. Why: when the row it
 * points at is hard-deleted, SetNull nulls the typed key, and without a plain id the row no longer says what
 * it pointed at; the required-FK rule (apps/api/src/hooks/falsePolymorphism/toRules.ts) accepts that plain
 * id in the key's place. `Cascade` arms are exempt: their row goes with the target. So is a relation to a
 * soft-delete model (registries/softDeleteModels.ts): it is never hard-deleted, so SetNull never fires.
 */
import ts from 'typescript';
import {
  applyExemptionsAndBaselineThenExit,
  fetchSource,
  lineAt,
  listFiles,
  type Violation,
} from './ciRuleRunner';

const REGISTRY = 'packages/db/src/registries/falsePolymorphism.ts';
const SOFT_DELETE_MODELS = 'packages/db/src/registries/softDeleteModels.ts';
const AUDIT_ENABLED_MODELS = 'packages/db/src/registries/auditEnabledModels.ts';
const MODEL = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

type Axis = { field: string; hasDualPolymorphismId: boolean; foreignKeys: string[] };

const propertyOf = (node: ts.ObjectLiteralExpression, name: string) =>
  node.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === name,
  )?.initializer;

const stringsIn = (node: ts.Node): string[] => {
  const found: string[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isStringLiteral(child)) found.push(child.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

const unwrapExpression = (node: ts.Expression): ts.Expression =>
  ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrapExpression(node.expression)
    : node;

const fetchSourceIfPresent = (file: string): string => {
  try {
    return fetchSource(file);
  } catch {
    return '';
  }
};

// Soft-delete models are the audit-enabled models plus SOFT_DELETE_ONLY (registries/softDeleteModels.ts).
const softDeleteModels = (): Set<string> => {
  const softDeleteOnly =
    /SOFT_DELETE_ONLY\s*=\s*\[([^\]]*)\]/.exec(fetchSourceIfPresent(SOFT_DELETE_MODELS))?.[1] ?? '';
  const auditEnabled = fetchSourceIfPresent(AUDIT_ENABLED_MODELS);
  return new Set([
    ...[...softDeleteOnly.matchAll(/'(\w+)'/g)].map(([, model]) => model),
    ...[...auditEnabled.matchAll(/AuditSubjectModel\.(\w+)/g)].map(([, model]) => model),
  ]);
};

const registeredAxes = (): Map<string, Axis[]> => {
  const source = ts.createSourceFile(REGISTRY, fetchSource(REGISTRY), ts.ScriptTarget.Latest, true);
  const axesByModel = new Map<string, Axis[]>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'PolymorphismRegistry' &&
      node.initializer &&
      ts.isObjectLiteralExpression(unwrapExpression(node.initializer))
    ) {
      for (const entry of (unwrapExpression(node.initializer) as ts.ObjectLiteralExpression)
        .properties) {
        if (!ts.isPropertyAssignment(entry) || !ts.isObjectLiteralExpression(entry.initializer))
          continue;
        const axes = propertyOf(entry.initializer, 'axes');
        if (!axes || !ts.isArrayLiteralExpression(axes)) continue;
        axesByModel.set(
          entry.name.getText(source),
          axes.elements.filter(ts.isObjectLiteralExpression).map((axis) => {
            const field = propertyOf(axis, 'field');
            const fkMap = propertyOf(axis, 'fkMap');
            return {
              field: field && ts.isStringLiteral(field) ? field.text : '',
              hasDualPolymorphismId: propertyOf(axis, 'dualPolymorphismId') !== undefined,
              foreignKeys: fkMap ? stringsIn(fkMap) : [],
            };
          }),
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return axesByModel;
};

const axesByModel = registeredAxes();
const neverHardDeleted = softDeleteModels();
const violations: Violation[] = [];

for (const file of listFiles(['packages'], /\.prisma$/)) {
  const source = fetchSource(file);
  MODEL.lastIndex = 0;
  for (let m = MODEL.exec(source); m !== null; m = MODEL.exec(source)) {
    const [, model, body] = m;
    const axes = axesByModel.get(model);
    if (!axes) continue;
    const bodyOffset = m.index + m[0].indexOf('{') + 1;
    for (const relation of body.matchAll(
      /^[ \t]*(\w+)[ \t]+(\w+)\??[ \t]+@relation\(([^)]*)\)/gm,
    )) {
      const [, name, target, args] = relation;
      if (!/onDelete:\s*SetNull\b/.test(args)) continue;
      if (neverHardDeleted.has(target)) continue;
      const columns =
        /fields:\s*\[([^\]]*)\]/
          .exec(args)?.[1]
          .split(',')
          .map((c) => c.trim()) ?? [];
      const axis = axes.find((a) => columns.some((column) => a.foreignKeys.includes(column)));
      if (!axis || axis.hasDualPolymorphismId) continue;
      violations.push({
        file,
        line: lineAt(source, bodyOffset + (relation.index ?? 0)),
        key: `${model}.${name}`,
        detail: `${model}.${name} sets null on a ${axis.field} arm; register ${axis.field} with a dualPolymorphismId plain id, or cascade`,
      });
    }
  }
}

applyExemptionsAndBaselineThenExit({
  rule: 'set-null-arm-requires-dual-polymorphism-id',
  violations,
  failureExplanationLines: [
    'Relations on a false-polymorphic axis that set null when their target is deleted, on an axis',
    'with no dual polymorphism id: the row would lose what it pointed at. Register the axis with',
    '`dualPolymorphismId` (as Entitlement.sourceId) in packages/db/src/registries/falsePolymorphism.ts,',
    'or make the relation onDelete: Cascade.',
  ],
  passMessage: 'Every set-null arm of a false-polymorphic axis keeps a dual polymorphism id.',
});
