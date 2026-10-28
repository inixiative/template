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
  const current = (stored as EntitlementEntry[] | null) ?? [];
  const removed = current.filter((entry) => remove.some((match) => isEqual(match, entry)));
  await validateEntitlementGrants(writer, [...add, ...removed] as EntitlementEntry[]);
  const kept = current.filter((entry) => !removed.includes(entry));
  return uniqWith([...kept, ...(add as EntitlementEntry[])], isEqual);
};
