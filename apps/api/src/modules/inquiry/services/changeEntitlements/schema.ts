/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses primitive:authz
 */
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { entitlementInputSchema } from '@template/permissions/rebac';
import { baseResolutionInputSchema } from '@template/shared/inquiry';
import { z } from 'zod';

export const integrationResourceKeySchema = z.strictObject({
  integrationId: z.string().min(1),
  kind: z.string().min(1),
  externalId: z.string().min(1),
});

const entitlementOnIntegrationResourceKeySchema = entitlementInputSchema
  .omit({ sourceModel: true, sourceId: true })
  .extend({
    sourceModel: z.literal(EntitlementResourceModel.IntegrationResource),
    source: integrationResourceKeySchema,
  })
  .strict();

export const requestedEntitlementSchema = z.union([
  entitlementInputSchema,
  entitlementOnIntegrationResourceKeySchema,
]);

const changes = {
  add: z.array(requestedEntitlementSchema).default([]),
  remove: z.array(z.string().min(1)).default([]),
};

export const changeEntitlementsContentSchema = z
  .object(changes)
  .refine(({ add, remove }) => add.length + remove.length > 0, {
    message: 'Name at least one entitlement to add or remove',
  });

export const changeEntitlementsResolutionInputSchema = baseResolutionInputSchema.extend(changes);

export type IntegrationResourceKey = z.infer<typeof integrationResourceKeySchema>;
export type RequestedEntitlement = z.infer<typeof requestedEntitlementSchema>;
export type ChangeEntitlementsContent = z.infer<typeof changeEntitlementsContentSchema>;
export type ChangeEntitlementsResolutionInput = z.infer<
  typeof changeEntitlementsResolutionInputSchema
>;
