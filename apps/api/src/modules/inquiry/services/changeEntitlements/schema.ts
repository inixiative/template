/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses primitive:authz
 */
import { entitlementInputsSchema } from '@template/permissions/rebac';
import { baseResolutionInputSchema } from '@template/shared/inquiry';
import { z } from 'zod';

const changes = {
  add: entitlementInputsSchema.default([]),
  remove: z.array(z.string().min(1)).default([]),
};

export const changeEntitlementsContentSchema = z
  .object(changes)
  .refine(({ add, remove }) => add.length + remove.length > 0, {
    message: 'Name at least one entitlement to add or remove',
  });

export const changeEntitlementsResolutionInputSchema = baseResolutionInputSchema.extend(changes);

export type ChangeEntitlementsContent = z.infer<typeof changeEntitlementsContentSchema>;
export type ChangeEntitlementsResolutionInput = z.infer<
  typeof changeEntitlementsResolutionInputSchema
>;
