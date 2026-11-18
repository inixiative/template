/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { polymorphicKeyColumn } from '@template/db/registries/polymorphicAxisPointsAt';
import type { ModelName } from '@template/db/utils/modelNames';

/** An owner by the kinds it is keyed on: `{ Organization: id, Space: null, User: null }` is the organization alone. */
export type OwnerKeys = Partial<Record<ModelName, string | null>>;

const ownerKeyColumn = (model: ModelName, axisField: string, kind: string): string => {
  const column = polymorphicKeyColumn(model, axisField, kind);
  if (!column) throw new Error(`${model}.${axisField} has no ${kind} arm to filter an owner by`);
  return column;
};

/** Rows whose axis is the owner or a record that carries its keys (`carriesOwnerKeysOf`): one flat filter, the caller naming the keys that must be null. */
export const whereAxisCarriesOwnerKeys = (
  model: ModelName,
  axisField: string,
  owner: OwnerKeys,
): Record<string, string | null> =>
  Object.fromEntries(
    Object.entries(owner).map(([kind, id]) => [ownerKeyColumn(model, axisField, kind), id ?? null]),
  );
