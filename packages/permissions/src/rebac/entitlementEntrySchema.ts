/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { type Condition, validateRule } from '@inixiative/json-rules';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { z } from 'zod';

const resources = Object.keys(rebacSchema.permissions) as [string, ...string[]];

/** A stored entitlement: actions on a resource, from an anchor. Its owner is the delegate's owner. */
const entitlementEntrySchema = z
  .object({
    resource: z.enum(resources),
    anchor: z.object({ resource: z.enum(resources), id: z.string().min(1) }).strict(),
    actions: z.record(z.string(), z.boolean()),
    where: (
      z
        .record(z.string(), z.unknown())
        .refine((where) => validateRule(where, { positive: true }).ok, {
          message:
            'where is a positive json-rules condition (no negation, isEmpty, notExists, if, array or aggregate): omit it for none',
        }) as unknown as z.ZodType<Condition>
    ).optional(),
  })
  .strict();

export const entitlementEntriesSchema = z.array(entitlementEntrySchema);

export const parseEntitlements = (
  stored: unknown,
): z.infer<typeof entitlementEntriesSchema> | null =>
  stored == null ? null : entitlementEntriesSchema.parse(stored);
