/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type PolymorphicAxis,
  type PolymorphicValue,
  polymorphicAxis,
} from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';
import { polymorphicArmRelation } from '@template/db/utils/polymorphicArmKeys';

const ownerAxisField = 'ownerModel';

/** An arm's columns by the column of the row they point at: `{ id: 'targetSpaceId', organizationId: 'targetOrganizationId' }`. */
const armColumnsByTarget = (
  model: ModelName,
  axisField: string,
  value: string,
): Record<string, string> => {
  const { foreignKey } = polymorphicArmRelation(model, axisField, value);
  return typeof foreignKey === 'string' ? { id: foreignKey } : (foreignKey ?? {});
};

/** The column on this axis that holds a row of `kind`'s id, read from the arm's Prisma relation. */
export const axisColumnFor = (model: ModelName, axisField: string, kind: string): string => {
  const column = armColumnsByTarget(model, axisField, kind).id;
  if (!column) throw new Error(`${model}.${axisField}=${kind} has no column for its id`);
  return column;
};

/**
 * The parent's owner keys a delegating value carries, each with the column that holds it on this
 * axis. Paired through the Prisma relations: for each owner kind both the parent's owner axis and
 * this axis point at, the column naming the same field of that kind's row.
 */
export const delegatedKeyPairs = (
  model: ModelName,
  axis: PolymorphicAxis,
  value: unknown,
): { column: string; parentKey: string }[] => {
  const parent = axis.delegates?.[value as PolymorphicValue];
  if (!parent) return [];
  const pairs = new Map<string, string>();
  for (const [kind, keys] of Object.entries(polymorphicAxis(parent, ownerAxisField).fkMap)) {
    if (!keys?.length || !axis.fkMap[kind as PolymorphicValue]?.length) continue;
    const own = armColumnsByTarget(model, axis.field, kind);
    for (const [field, parentKey] of Object.entries(
      armColumnsByTarget(parent, ownerAxisField, kind),
    )) {
      const column = own[field];
      if (!column)
        throw new Error(`${model}.${axis.field}=${kind} has no column for ${kind}.${field}`);
      pairs.set(parentKey, column);
    }
  }
  return [...pairs].map(([parentKey, column]) => ({ column, parentKey }));
};

export const delegatedKeys = (model: ModelName, axis: PolymorphicAxis, value: unknown): string[] =>
  delegatedKeyPairs(model, axis, value).map(({ column }) => column);

/** The owner keys a row of `model` holds when its owner axis says `value`: its arm's and what its delegate carries. */
export const ownerKeysHeld = (model: ModelName, value: PolymorphicValue): string[] => {
  const axis = polymorphicAxis(model, ownerAxisField);
  return [...(axis.fkMap[value] ?? []), ...delegatedKeys(model, axis, value)];
};
