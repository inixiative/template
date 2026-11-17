/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  delegatePrefix,
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

/** Rows whose axis is the owner or something it holds beneath it: one flat filter, because each row carries its delegate's owner keys. */
export const whereAxisCarriesOwnerKeys = (
  model: ModelName,
  axisField: string,
  owner: OwnerKeys,
): Where => prefixedKeys(axisPrefix(model, polymorphicAxis(model, axisField)), owner);
