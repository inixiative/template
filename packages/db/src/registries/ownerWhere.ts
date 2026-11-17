/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { axisColumnFor } from '@template/db/registries/carriedOwnerKeys';
import type { ModelName } from '@template/db/utils/modelNames';

/** An owner by the kinds it is keyed on: `{ Organization: id, Space: null, User: null }` is the organization alone. */
export type OwnerKeys = Partial<Record<ModelName, string | null>>;

/** Rows whose axis is the owner or a record that carries its keys (`carriesOwnerKeysOf`): one flat filter, the caller naming the keys that must be null. */
export const whereAxisCarriesOwnerKeys = (
  model: ModelName,
  axisField: string,
  owner: OwnerKeys,
): Record<string, string | null> =>
  Object.fromEntries(
    Object.entries(owner).map(([kind, id]) => [axisColumnFor(model, axisField, kind), id ?? null]),
  );
