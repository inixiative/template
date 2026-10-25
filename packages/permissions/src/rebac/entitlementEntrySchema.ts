/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { rebacSchema } from '@template/permissions/rebac/schema';
import { z } from 'zod';

const resources = Object.keys(rebacSchema.permissions) as [string, ...string[]];

/** A stored entitlement: actions on a resource, from an anchor. Its owner is the delegate's owner. */
export const entitlementEntrySchema = z
  .object({
    resource: z.enum(resources),
    anchor: z.object({ resource: z.enum(resources), id: z.string().min(1) }).strict(),
    actions: z.record(z.string(), z.boolean()),
  })
  .strict();

export const entitlementEntriesSchema = z.array(entitlementEntrySchema);

export type StoredEntitlement = z.infer<typeof entitlementEntrySchema>;
