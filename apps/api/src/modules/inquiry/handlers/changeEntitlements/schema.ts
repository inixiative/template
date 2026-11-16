/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses primitive:authz
 */
import { entitlementInputsSchema } from '@template/permissions/rebac';
import { baseResolutionInputSchema } from '@template/shared/inquiry';
import { z } from 'zod';

const changesSchema = z
  .object({
    add: entitlementInputsSchema.default([]),
    remove: z.array(z.string().min(1)).default([]),
  })
  .refine(({ add, remove }) => add.length + remove.length > 0, {
    message: 'Name at least one entitlement to add or remove; to give nothing, deny',
  });

export const changeEntitlementsContentSchema = changesSchema;

export const changeEntitlementsResolutionInputSchema = baseResolutionInputSchema
  .extend({
    add: entitlementInputsSchema.default([]),
    remove: z.array(z.string().min(1)).default([]),
  })
  .refine(({ add, remove }) => add.length + remove.length > 0, {
    message: 'An approval sends back what it approves; to give nothing, deny',
  });

export type ChangeEntitlementsContent = z.infer<typeof changeEntitlementsContentSchema>;
export type ChangeEntitlementsResolutionInput = z.infer<
  typeof changeEntitlementsResolutionInputSchema
>;
