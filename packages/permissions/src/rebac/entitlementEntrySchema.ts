/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { z } from 'zod';

const resources = Object.keys(rebacSchema.permissions) as [string, ...string[]];

/** A stored entitlement: actions on a resource, from an anchor. Its owner is the delegate's owner. */
const entitlementEntrySchema = z
  .object({
    resource: z.enum(resources),
    anchor: z
      .object({
        resource: z.enum(resources),
        id: z.string().min(1),
        path: z.string().min(1).optional(),
      })
      .strict(),
    actions: z.record(z.string(), z.boolean()),
    where: (z.record(z.string(), z.unknown()) as unknown as z.ZodType<Condition>).optional(),
  })
  .strict();

export const entitlementEntriesSchema = z.array(entitlementEntrySchema);

export const parseEntitlements = (
  stored: unknown,
): z.infer<typeof entitlementEntriesSchema> | null =>
  stored == null ? null : entitlementEntriesSchema.parse(stored);
