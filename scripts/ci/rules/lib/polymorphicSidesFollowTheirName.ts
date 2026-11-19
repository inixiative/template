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
import { applyExemptionsAndBaselineThenExit, type Violation } from './ciRuleRunner';
import { POLYMORPHISM_REGISTRY, readPolymorphicSides, readPrismaModels } from './schemaSources';

const TENANCY_COLUMNS = new Set([
  'organizationId',
  'spaceId',
  'userId',
  'integrationId',
  'projectId',
]);

const prismaColumnsByModel = (): Map<string, Set<string>> =>
  new Map(
    readPrismaModels().map(({ name, body }) => [
      name,
      new Set([...body.matchAll(/^[ \t]*(\w+)[ \t]+\w/gm)].map(([, column]) => column ?? '')),
    ]),
  );

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const violations: Violation[] = [];
const columnsByModel = prismaColumnsByModel();

for (const side of readPolymorphicSides()) {
  const report = (key: string, detail: string) =>
    violations.push({
      file: POLYMORPHISM_REGISTRY,
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
