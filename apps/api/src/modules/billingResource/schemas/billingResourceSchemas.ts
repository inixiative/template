/**
 * @atlas
 * @kind schema
 * @partOf feature:billing
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import { BillingResourceScalarSchema } from '@template/db';
import {
  BillingAccountStatus,
  BillingResourceTargetModel,
} from '@template/db/generated/client/enums';
import { polymorphicSchema } from '@template/db/registries/polymorphicSchema';
import { uuidV7Schema } from '@template/shared/utils';
import { billingAccountReadResponseSchema } from '#/modules/billingAccount/schemas/billingAccountSchemas';

export const BILLING_RESOURCE_IMMUTABLE_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;

export const billingResourceReadResponseSchema = BillingResourceScalarSchema;

export const billingResourceCreatePolymorphicSchema = polymorphicSchema(
  'BillingResource',
  'resourceModel',
  {
    extend: {
      billingAccountId: uuidV7Schema,
      replaceExisting: z.boolean().optional(),
    },
  },
);

export const billingResourceCreateBodySchema = z.object({
  billingAccountId: uuidV7Schema,
  resourceModel: z.enum(BillingResourceTargetModel),
  resourceOrganizationId: uuidV7Schema.optional(),
  resourceSpaceId: uuidV7Schema.optional(),
  resourceUserId: uuidV7Schema.optional(),
  resourceProjectId: uuidV7Schema.optional(),
  resourceProjectIntegrationId: uuidV7Schema.optional(),
  replaceExisting: z.boolean().optional(),
});

export const billingResolveTargetModelSchema = z.enum([
  'User',
  'Organization',
  'Space',
  'OrganizationUser',
  'SpaceUser',
  'Project',
  'ProjectIntegration',
]);

export const billingResourceResolveQuerySchema = z.object({
  targetModel: billingResolveTargetModelSchema,
  id: z.string().min(1),
});

export const billingResourceResolveResponseSchema = z.object({
  resolved: z.boolean(),
  status: z.enum(BillingAccountStatus).nullable(),
  source: z.enum(['binding', 'ownerDefault']).nullable(),
  boundAt: z.string().nullable(),
  billingResourceId: z.string().nullable(),
  billingAccount: billingAccountReadResponseSchema.nullable(),
});
