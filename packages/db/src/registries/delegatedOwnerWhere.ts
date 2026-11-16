/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  delegatePrefix,
  ownerKeysOf,
  type PolymorphicAxis,
  type PolymorphicValue,
  polymorphicAxis,
  prefixedName,
} from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

/** An owner by its standard key columns (`organizationId`, `spaceId`, `userId`, `integrationId`); null means "holds none". */
export type OwnerKeys = Record<string, string | null>;

type Where = Record<string, unknown>;

const delegateValues = (axis: PolymorphicAxis) =>
  Object.keys(axis.delegates ?? {}) as PolymorphicValue[];

const axisPrefix = (model: ModelName, axis: PolymorphicAxis): string => {
  const prefixes = [...new Set(delegateValues(axis).map((value) => delegatePrefix(axis, value)))];
  if (prefixes.length !== 1)
    throw new Error(`${model}.${axis.field} needs delegates that share one key prefix`);
  return prefixes[0]!;
};

const prefixedKeys = (prefix: string, owner: OwnerKeys): Where =>
  Object.fromEntries(Object.entries(owner).map(([key, id]) => [prefixedName(prefix, key), id]));

/** The owner's keys as the delegate row holds them, or null when that row can never hold them. */
const keysOnParent = (parent: ModelName, owner: OwnerKeys): Where | null => {
  const held = ownerKeysOf(parent);
  const ownId = prefixedName('', `${parent}Id`);
  const where: Where = {};
  for (const [key, id] of Object.entries(owner)) {
    if (key === ownId) where.id = id;
    else if (held.includes(key)) where[key] = id;
    else if (id !== null) return null;
  }
  return where;
};

/** Rows whose axis carries the owner's keys: the one flat filter the carried keys allow. */
export const whereAxisCarriesOwnerKeys = (
  model: ModelName,
  axisField: string,
  owner: OwnerKeys,
): Where => prefixedKeys(axisPrefix(model, polymorphicAxis(model, axisField)), owner);

/** Rows whose axis points at the owner, or at a delegate the owner holds, read through each delegate's own row. */
export const whereAxisIsOwnerOrItsDelegate = (
  model: ModelName,
  axisField: string,
  owner: OwnerKeys,
): { OR: Where[] } => {
  const axis = polymorphicAxis(model, axisField);
  const prefix = axisPrefix(model, axis);
  const delegating = delegateValues(axis);
  return {
    OR: [
      { [axis.field]: { notIn: delegating }, ...prefixedKeys(prefix, owner) },
      ...delegating.flatMap((value) => {
        const parent = axis.delegates![value]!;
        const keys = keysOnParent(parent, owner);
        return keys ? [{ [axis.field]: value, [prefixedName(prefix, parent)]: keys }] : [];
      }),
    ],
  };
};
