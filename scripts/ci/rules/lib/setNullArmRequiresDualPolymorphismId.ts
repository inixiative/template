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
import { applyExemptionsAndBaselineThenExit, lineAt, type Violation } from './ciRuleRunner';
import { readPolymorphicSides, readPrismaModels, readSoftDeleteModels } from './schemaSources';

const { sides: registeredSides, unreadable } = readPolymorphicSides();
const sidesByModel = Map.groupBy(registeredSides, (side) => side.model);
const neverHardDeleted = readSoftDeleteModels();
const violations: Violation[] = [...unreadable];

for (const { file, source, name: model, body, bodyOffset } of readPrismaModels()) {
  const sides = sidesByModel.get(model);
  if (!sides) continue;
  for (const relation of body.matchAll(/^[ \t]*(\w+)[ \t]+(\w+)\??[ \t]+@relation\(([^)]*)\)/gm)) {
    const [, name, target, args] = relation;
    if (!/onDelete:\s*SetNull\b/.test(args ?? '') || neverHardDeleted.has(target ?? '')) continue;
    const columns =
      /fields:\s*\[([^\]]*)\]/
        .exec(args ?? '')?.[1]
        ?.split(',')
        .map((column) => column.trim()) ?? [];
    const side = sides.find((s) =>
      s.arms.some(({ keys }) => keys.some((key) => columns.includes(key))),
    );
    if (!side || side.dualPolymorphismId) continue;
    violations.push({
      file,
      line: lineAt(source, bodyOffset + (relation.index ?? 0)),
      key: `${model}.${name}`,
      detail: `${model}.${name} sets null on a ${side.field} arm; register ${side.field} with a dualPolymorphismId plain id, or cascade`,
    });
  }
}

applyExemptionsAndBaselineThenExit({
  rule: 'set-null-arm-requires-dual-polymorphism-id',
  violations,
  failureExplanationLines: [
    'Relations on a false-polymorphic axis that set null when their target is hard-deleted, on an axis',
    'with no dual polymorphism id: the row would lose what it pointed at. Register the axis with',
    '`dualPolymorphismId` (as Entitlement.sourceId) in packages/db/src/registries/falsePolymorphism.ts,',
    'or make the relation onDelete: Cascade.',
  ],
  passMessage: 'Every set-null arm of a false-polymorphic axis keeps a dual polymorphism id.',
});
