/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { type AccessorName, fetchOne, hydrate } from '@template/db';
import type { EntitlementEntry, Permix } from '@template/permissions';
import { canGrantEntitlement } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

const anchorRecord = async ({ resource, id }: EntitlementEntry['anchor']) => {
  const model = resource.slice('db:'.length) as AccessorName;
  const row = await fetchOne<{ id: string }>(model, id);
  return row ? hydrate(model, row) : null;
};

const grantable = async (writer: Permix, entry: EntitlementEntry): Promise<boolean> => {
  const anchor = await anchorRecord(entry.anchor);
  if (!anchor)
    throw makeError({
      status: 422,
      message: `No ${entry.anchor.resource} ${entry.anchor.id} to grant from`,
    });
  return canGrantEntitlement(writer, entry, anchor);
};

export const validateEntitlementGrants = async (
  writer: Permix,
  entries: EntitlementEntry[],
): Promise<void> => {
  for (const entry of entries)
    if (!(await grantable(writer, entry)))
      throw makeError({ status: 403, message: 'A delegate holds your permissions or less' });
};
