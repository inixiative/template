/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import type { EntitlementEntry, Permix } from '@template/permissions';
import { entitlementEntriesSchema } from '@template/permissions/rebac';
import { isEqual, uniqWith } from 'lodash-es';
import { validateEntitlementGrants } from '#/lib/permissions/validateEntitlementGrants';

export const entitlementChangesSchema = z.object({
  add: entitlementEntriesSchema.optional(),
  remove: entitlementEntriesSchema.optional(),
});

export type EntitlementChanges = z.infer<typeof entitlementChangesSchema>;

export const changeEntitlements = async (
  writer: Permix,
  stored: unknown,
  { add = [], remove = [] }: EntitlementChanges,
): Promise<EntitlementEntry[]> => {
  await validateEntitlementGrants(writer, [...add, ...remove] as EntitlementEntry[]);
  const kept = ((stored as EntitlementEntry[] | null) ?? []).filter(
    (entry) => !remove.some((removed) => isEqual(removed, entry)),
  );
  return uniqWith([...kept, ...(add as EntitlementEntry[])], isEqual);
};
