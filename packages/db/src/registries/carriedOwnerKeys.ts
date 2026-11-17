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
import { polymorphicArmColumns } from '@template/db/utils/polymorphicArmKeys';

const ownerAxisField = 'ownerModel';

/** The record whose owner keys a row carries when its axis says `value`, or null when that value carries none. */
export const ownerKeysCarriedFrom = (axis: PolymorphicAxis, value: unknown): ModelName | null =>
  axis.carriesOwnerKeysOf?.includes(value as PolymorphicValue) ? (value as ModelName) : null;

/** The column on this axis that holds a row of `kind`'s id, read from the arm's Prisma relation. */
export const axisColumnFor = (model: ModelName, axisField: string, kind: string): string => {
  const column = polymorphicArmColumns(model, axisField, kind).id;
  if (!column) throw new Error(`${model}.${axisField}=${kind} has no column for its id`);
  return column;
};

/**
 * The owner keys a row carries from the record its axis value names, each with the column that holds it on this
 * axis. Paired through the Prisma relations: for each owner kind both the parent's owner axis and
 * this axis point at, the column naming the same field of that kind's row.
 */
export const carriedOwnerKeyPairs = (
  model: ModelName,
  axis: PolymorphicAxis,
  value: unknown,
): { column: string; parentKey: string }[] => {
  const parent = ownerKeysCarriedFrom(axis, value);
  if (!parent) return [];
  const pairs = new Map<string, string>();
  for (const [kind, keys] of Object.entries(polymorphicAxis(parent, ownerAxisField).fkMap)) {
    if (!keys?.length || !axis.fkMap[kind as PolymorphicValue]?.length) continue;
    const own = polymorphicArmColumns(model, axis.field, kind);
    for (const [field, parentKey] of Object.entries(
      polymorphicArmColumns(parent, ownerAxisField, kind),
    )) {
      const column = own[field];
      if (!column)
        throw new Error(`${model}.${axis.field}=${kind} has no column for ${kind}.${field}`);
      pairs.set(parentKey, column);
    }
  }
  return [...pairs].map(([parentKey, column]) => ({ column, parentKey }));
};

export const carriedOwnerKeyColumns = (
  model: ModelName,
  axis: PolymorphicAxis,
  value: unknown,
): string[] => carriedOwnerKeyPairs(model, axis, value).map(({ column }) => column);

/** The owner keys a row of `model` holds when its owner axis says `value`: its arm's and what its delegate carries. */
export const ownerKeysHeld = (model: ModelName, value: PolymorphicValue): string[] => {
  const axis = polymorphicAxis(model, ownerAxisField);
  return [...(axis.fkMap[value] ?? []), ...carriedOwnerKeyColumns(model, axis, value)];
};
