/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { type AccessorName, fetchOne, type HydratedRecord, hydrate } from '@template/db';
import type { EntitlementEntry, Permix } from '@template/permissions';
import { canGrantEntitlement, placeEntitlement, schemaMap } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

const modelOf = (resource: string) => resource.slice('db:'.length) as AccessorName;

const anchorRecord = async ({ resource, id }: EntitlementEntry['anchor']) => {
  const model = modelOf(resource);
  const row = await fetchOne<{ id: string }>(model, id);
  return row ? hydrate(model, row) : null;
};

const placedRecord = async (entry: EntitlementEntry) => {
  const anchor = await anchorRecord(entry.anchor);
  if (!anchor)
    throw makeError({
      status: 422,
      message: `No ${entry.anchor.resource} ${entry.anchor.id} to grant from`,
    });
  const placed = placeEntitlement(schemaMap, entry, anchor);
  if (!placed)
    throw makeError({
      status: 422,
      message: `${entry.resource} does not reach ${entry.anchor.resource} by ${entry.anchor.path ?? 'no path'}: anchor on its tree`,
    });
  return placed as HydratedRecord;
};

export const validateEntitlementGrants = async (
  writer: Permix,
  entries: EntitlementEntry[],
): Promise<void> => {
  for (const entry of entries)
    if (!canGrantEntitlement(writer, entry, await placedRecord(entry)))
      throw makeError({ status: 403, message: 'A delegate holds your permissions or less' });
};
