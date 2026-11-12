#!/usr/bin/env bun
/**
 * Detector for the set-null-polymorphism-materialized CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/setNullPolymorphismMaterialized.ts
 *
 * A relation on a false-polymorphic axis whose typed foreign key is `onDelete: SetNull` must sit on an
 * axis registered with a `materialized` plain id column (packages/db/src/registries/falsePolymorphism.ts),
 * as Entitlement's `sourceId` is. Why: when the row it points at is hard-deleted, SetNull nulls the
 * typed key, and without a plain id the row no longer says what it pointed at; the required-FK rule
 * (apps/api/src/hooks/falsePolymorphism/toRules.ts) accepts that plain id in the key's place.
 * `Cascade` arms are exempt: their row goes with the target.
 */
import ts from 'typescript';
import { finishFence, lineAt, listFiles, readSource, type Violation } from './fence';

const REGISTRY = 'packages/db/src/registries/falsePolymorphism.ts';
const MODEL = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

type Axis = { field: string; materialized: boolean; foreignKeys: string[] };

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

const registeredAxes = (): Map<string, Axis[]> => {
  const source = ts.createSourceFile(REGISTRY, readSource(REGISTRY), ts.ScriptTarget.Latest, true);
  const axesByModel = new Map<string, Axis[]>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'PolymorphismRegistry' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const entry of node.initializer.properties) {
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
              materialized: propertyOf(axis, 'materialized') !== undefined,
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
const violations: Violation[] = [];

for (const file of listFiles(['packages'], /\.prisma$/)) {
  const source = readSource(file);
  MODEL.lastIndex = 0;
  for (let m = MODEL.exec(source); m !== null; m = MODEL.exec(source)) {
    const [, model, body] = m;
    const axes = axesByModel.get(model);
    if (!axes) continue;
    const bodyOffset = m.index + m[0].indexOf('{') + 1;
    for (const relation of body.matchAll(/^[ \t]*(\w+)[ \t]+\w+\??[ \t]+@relation\(([^)]*)\)/gm)) {
      const [, name, args] = relation;
      if (!/onDelete:\s*SetNull\b/.test(args)) continue;
      const columns =
        /fields:\s*\[([^\]]*)\]/
          .exec(args)?.[1]
          .split(',')
          .map((c) => c.trim()) ?? [];
      const axis = axes.find((a) => columns.some((column) => a.foreignKeys.includes(column)));
      if (!axis || axis.materialized) continue;
      violations.push({
        file,
        line: lineAt(source, bodyOffset + (relation.index ?? 0)),
        key: `${model}.${name}`,
        detail: `${model}.${name} sets null on a ${axis.field} arm; register ${axis.field} with a materialized plain id, or cascade`,
      });
    }
  }
}

finishFence({
  rule: 'set-null-polymorphism-materialized',
  violations,
  explain: [
    'Relations on a false-polymorphic axis that set null when their target is deleted, on an axis',
    'with no materialized plain id: the row would lose what it pointed at. Register the axis with',
    '`materialized` (as Entitlement.sourceId) in packages/db/src/registries/falsePolymorphism.ts,',
    'or make the relation onDelete: Cascade.',
  ],
  clean: 'Every set-null arm of a false-polymorphic axis keeps a materialized plain id.',
});
