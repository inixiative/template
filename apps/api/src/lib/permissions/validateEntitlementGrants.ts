/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { type AccessorName, fetchOne, type HydratedRecord, hydrate } from '@template/db';
import type { EntitlementEntry, Permix } from '@template/permissions';
import {
  canGrantEntitlement,
  check,
  placeEntitlement,
  rebacSchema,
  schemaMap,
} from '@template/permissions/rebac';
import { actorHoldsItsChain } from '@template/permissions/rebac/schemaHelpers';
import { makeError } from '#/lib/errors';

const modelOf = (resource: string) => resource.slice('db:'.length) as AccessorName;

const anchorRecord = async ({ resource, id }: EntitlementEntry['anchor']) => {
  const model = modelOf(resource);
  const row = await fetchOne<{ id: string }>(model, id);
  return row ? hydrate(model, row) : null;
};

const placedRecords = async (entry: EntitlementEntry) => {
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
  return placed as HydratedRecord[];
};

export type Delegate = { model: AccessorName; record: HydratedRecord };

export const validateEntitlementGrants = async (
  writer: Permix,
  entries: EntitlementEntry[],
  delegate?: Delegate,
): Promise<void> => {
  const yours =
    !!delegate && check(writer, rebacSchema, delegate.model, delegate.record, actorHoldsItsChain);
  for (const entry of entries)
    for (const placed of await placedRecords(entry))
      if (!yours && !canGrantEntitlement(writer, entry, placed))
        throw makeError({ status: 403, message: 'A delegate holds your permissions or less' });
};
