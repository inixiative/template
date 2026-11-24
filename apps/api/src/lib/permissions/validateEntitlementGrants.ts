/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */

import { accessorOfResource, db, type HydratedRecord, hydrate } from '@template/db';
import type { EntitlementEntry, Permix } from '@template/permissions';
import {
  canGrantEntitlement,
  entitlementProblem,
  pseudoRecordsOfEntitlement,
  schemaMap,
} from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

const anchorRecord = async ({ resource, id }: EntitlementEntry['anchor']) => {
  const model = accessorOfResource(resource);
  const row = (await db.delegate(model).findFirst({ where: { id } })) as HydratedRecord | null;
  return row ? hydrate(model, row) : null;
};

const pseudoRecordsOf = async (entry: EntitlementEntry) => {
  const problem = entitlementProblem(entry);
  if (problem) throw makeError({ status: 422, message: problem });
  const anchor = await anchorRecord(entry.anchor);
  if (!anchor)
    throw makeError({
      status: 422,
      message: `No ${entry.anchor.resource} ${entry.anchor.id} to grant from`,
    });
  const pseudoRecords = pseudoRecordsOfEntitlement(schemaMap, entry, anchor);
  if (!pseudoRecords)
    throw makeError({
      status: 422,
      message: `${entry.resource} does not reach ${entry.anchor.resource} by ${entry.anchor.path ?? 'no path'}: anchor on its tree`,
    });
  return pseudoRecords as HydratedRecord[];
};

const describeEntry = ({ resource, anchor, actions }: EntitlementEntry) =>
  `${Object.keys(actions).join(', ')} on ${resource} at ${anchor.resource} ${anchor.id}${anchor.path ? ` by ${anchor.path}` : ''}`;

export const validateEntitlementGrants = async (
  writer: Permix,
  entries: EntitlementEntry[],
): Promise<void> => {
  for (const entry of entries)
    for (const pseudoRecord of await pseudoRecordsOf(entry))
      if (!canGrantEntitlement(writer, entry, pseudoRecord))
        throw makeError({
          status: 403,
          message: `A delegate holds your permissions or less: you cannot give ${describeEntry(entry)}`,
        });
};
