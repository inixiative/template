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

export const ownerAxisField = 'ownerModel';

/** The record whose owner keys a row carries when its axis says `value`, or null when that value carries none. */
export const modelWhoseOwnerKeysAreCarried = (
  axis: PolymorphicAxis,
  value: unknown,
): ModelName | null =>
  axis.carriesOwnerKeysOf?.includes(value as ModelName) ? (value as ModelName) : null;

/**
 * The owner keys a row carries from the record its axis value names, each with the column that holds it on this
 * axis. Paired through the Prisma relations: for each owner kind both that record's owner axis and
 * this axis point at, the column naming the same field of that kind's row.
 */
export const carriedOwnerKeyPairs = (
  model: ModelName,
  axis: PolymorphicAxis,
  value: unknown,
): { column: string; carriedKey: string }[] => {
  const carriedFrom = modelWhoseOwnerKeysAreCarried(axis, value);
  if (!carriedFrom) return [];
  const pairs = new Map<string, string>();
  for (const [kind, keys] of Object.entries(polymorphicAxis(carriedFrom, ownerAxisField).fkMap)) {
    if (!keys?.length || !axis.fkMap[kind as PolymorphicValue]?.length) continue;
    const own = polymorphicArmColumns(model, axis.field, kind);
    for (const [field, carriedKey] of Object.entries(
      polymorphicArmColumns(carriedFrom, ownerAxisField, kind),
    )) {
      const column = own[field];
      if (!column)
        throw new Error(`${model}.${axis.field}=${kind} has no column for ${kind}.${field}`);
      pairs.set(carriedKey, column);
    }
  }
  return [...pairs].map(([carriedKey, column]) => ({ column, carriedKey }));
};

export const carriedOwnerKeyColumns = (
  model: ModelName,
  axis: PolymorphicAxis,
  value: unknown,
): string[] => carriedOwnerKeyPairs(model, axis, value).map(({ column }) => column);

/** The key columns a row holds when its axis says `value`: its arm's own, and the owner keys it carries. */
export const keysHeldOnAxis = (
  model: ModelName,
  axis: PolymorphicAxis,
  value: unknown,
): string[] => [
  ...(axis.fkMap[value as PolymorphicValue] ?? []),
  ...carriedOwnerKeyColumns(model, axis, value),
];
