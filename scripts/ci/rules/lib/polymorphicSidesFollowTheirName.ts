#!/usr/bin/env bun
/**
 * Detector for the polymorphic-sides-follow-their-name CI rule. Run from the repo (or fixture) root:
 *   bun scripts/ci/rules/lib/polymorphicSidesFollowTheirName.ts
 *
 * Every side registered in packages/db/src/registries/falsePolymorphism.ts is named by its discriminator,
 * `<side>Model`, and every column it uses says so:
 * - a side other than `owner` prefixes each key column with its name (`resourceUserId`, `senderSpaceId`);
 * - `owner` keys on the tenancy columns only (organizationId, spaceId, userId, and the delegate owners'
 *   integrationId, projectId), the names every model uses for the tenant a row lives in;
 * - a lowercase value (`default`, `admin`, `platform`) names no row and has no key columns; a PascalCase
 *   value is a model and has at least one;
 * - a `dualPolymorphismId` is `<side>Id`, and a Prisma model with a `<side>Id` column beside a registered
 *   `<side>Model` declares it as the side's dual polymorphism id.
 * Why (Aron 2026-11-19): one rule for every side, so a reader and the side adapter can derive a side's
 * columns from its name instead of learning each model's exceptions.
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
const TENANCY_COLUMNS = new Set([
  'organizationId',
  'spaceId',
  'userId',
  'integrationId',
  'projectId',
]);
const MODEL = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

type Side = {
  model: string;
  field: string;
  dualPolymorphismId?: string;
  arms: { value: string; keys: string[] }[];
  line: number;
};

const unwrapExpression = (node: ts.Expression): ts.Expression =>
  ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrapExpression(node.expression)
    : node;

const propertyOf = (node: ts.ObjectLiteralExpression, name: string) =>
  node.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === name,
  )?.initializer;

const stringLiteral = (node: ts.Node | undefined): string | undefined =>
  node && ts.isStringLiteral(node) ? node.text : undefined;

const registeredSides = (): Side[] => {
  const text = fetchSource(REGISTRY);
  const source = ts.createSourceFile(REGISTRY, text, ts.ScriptTarget.Latest, true);
  const sides: Side[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'PolymorphismRegistry' &&
      node.initializer
    ) {
      const registry = unwrapExpression(node.initializer);
      if (!ts.isObjectLiteralExpression(registry)) return;
      for (const entry of registry.properties) {
        if (!ts.isPropertyAssignment(entry) || !ts.isObjectLiteralExpression(entry.initializer))
          continue;
        const axes = propertyOf(entry.initializer, 'axes');
        if (!axes || !ts.isArrayLiteralExpression(axes)) continue;
        for (const axis of axes.elements.filter(ts.isObjectLiteralExpression)) {
          const fkMap = propertyOf(axis, 'fkMap');
          sides.push({
            model: entry.name.getText(source),
            field: stringLiteral(propertyOf(axis, 'field')) ?? '',
            dualPolymorphismId: stringLiteral(propertyOf(axis, 'dualPolymorphismId')),
            arms:
              fkMap && ts.isObjectLiteralExpression(fkMap)
                ? fkMap.properties.filter(ts.isPropertyAssignment).map((arm) => ({
                    value: arm.name.getText(source).replace(/^['"]|['"]$/g, ''),
                    keys: ts.isArrayLiteralExpression(arm.initializer)
                      ? arm.initializer.elements.flatMap((key) => stringLiteral(key) ?? [])
                      : [],
                  }))
                : [],
            line: lineAt(text, axis.getStart(source)),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return sides;
};

const prismaColumnsByModel = (): Map<string, Set<string>> => {
  const columns = new Map<string, Set<string>>();
  for (const file of listFiles(['packages'], /\.prisma$/)) {
    const source = fetchSource(file);
    MODEL.lastIndex = 0;
    for (let m = MODEL.exec(source); m !== null; m = MODEL.exec(source)) {
      const [, model, body] = m;
      columns.set(
        model,
        new Set([...body.matchAll(/^[ \t]*(\w+)[ \t]+\w/gm)].map(([, column]) => column)),
      );
    }
  }
  return columns;
};

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const violations: Violation[] = [];
const columnsByModel = prismaColumnsByModel();

for (const side of registeredSides()) {
  const report = (key: string, detail: string) =>
    violations.push({
      file: REGISTRY,
      line: side.line,
      key: `${side.model}.${side.field}${key}`,
      detail,
    });
  if (!side.field.endsWith('Model') || side.field === 'Model') {
    report('', `${side.model}.${side.field} is a side's discriminator; name it <side>Model`);
    continue;
  }
  const sideName = side.field.slice(0, -'Model'.length);
  for (const { value, keys } of side.arms) {
    const isPseudoRow = value.charAt(0) === value.charAt(0).toLowerCase();
    if (isPseudoRow && keys.length > 0)
      report(
        `.${value}`,
        `${side.model}.${side.field}=${value} is lowercase, so it names no row; give it no key columns`,
      );
    if (!isPseudoRow && keys.length === 0)
      report(
        `.${value}`,
        `${side.model}.${side.field}=${value} is a model; give it the key columns it points through`,
      );
    for (const key of keys) {
      if (
        sideName === 'owner'
          ? !TENANCY_COLUMNS.has(key)
          : !key.startsWith(sideName) ||
            key.charAt(sideName.length) !== key.charAt(sideName.length).toUpperCase()
      )
        report(
          `.${value}.${key}`,
          sideName === 'owner'
            ? `${side.model}.ownerModel=${value} keys on ${key}; an owner keys on tenancy columns only (${[...TENANCY_COLUMNS].join(', ')})`
            : `${side.model}.${side.field}=${value} keys on ${key}; name it ${sideName}${capitalize(key)}`,
        );
    }
  }
  const dualColumn = `${sideName}Id`;
  if (side.dualPolymorphismId && side.dualPolymorphismId !== dualColumn)
    report(
      '.dualPolymorphismId',
      `${side.model}.${side.field}'s dual polymorphism id is ${side.dualPolymorphismId}; name it ${dualColumn}`,
    );
  if (!side.dualPolymorphismId && columnsByModel.get(side.model)?.has(dualColumn))
    report(
      '.dualPolymorphismId',
      `${side.model} has ${dualColumn} beside ${side.field}; register it as the side's dualPolymorphismId`,
    );
}

applyExemptionsAndBaselineThenExit({
  rule: 'polymorphic-sides-follow-their-name',
  violations,
  failureExplanationLines: [
    'A polymorphic side whose columns do not follow its name. Each side is <side>Model; its key columns',
    'are <side><Column> (owner alone keys on the tenancy columns); lowercase values have no keys and models',
    'do; its dual polymorphism id is <side>Id, declared in the registry exactly when Prisma has the column.',
  ],
  passMessage: 'Every polymorphic side follows its name.',
});
