/**
 * @atlas
 * @kind schema
 * @partOf feature:featureFlag
 * @uses feature:segment
 */
import { z } from '@hono/zod-openapi';
import {
  FeatureFlagScalarInputSchema,
  FeatureFlagScalarSchema,
  FeatureFlagVariantScalarInputSchema,
  FeatureFlagVariantScalarSchema,
  SegmentScalarSchema,
} from '@template/db';
import { CustomerModel, ProviderModel, SegmentType } from '@template/db/generated/client/enums';
import { selectSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';

export const FEATURE_FLAG_CREATE_IMMUTABLE_FIELDS = ['ownerModel', 'userId', 'organizationId', 'spaceId'] as const;

export const featureFlagCreateBodySchema = FeatureFlagScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
  deletedAt: true,
});

export const featureFlagUpdateBodySchema = featureFlagCreateBodySchema
  .omit({ slug: true, subjectModel: true, valueType: true })
  .partial();

export const variantSegmentSchema = SegmentScalarSchema.pick(selectSegmentForCustomer).extend({
  featureFlagVariantId: z.string().nullable(),
  members: z.number().int().nonnegative(),
});

export const featureFlagVariantReadResponseSchema = FeatureFlagVariantScalarSchema.extend({
  segment: variantSegmentSchema.nullable(),
});

export const featureFlagReadResponseSchema = FeatureFlagScalarSchema.extend({
  variants: z.array(featureFlagVariantReadResponseSchema),
});

export const internalSegmentSchema = z.object({
  type: z.enum(SegmentType),
  conditions: z.unknown(),
});

export const sampleSchema = z.object({
  percent: z.number().min(0).max(100),
  from: z.string().optional(),
});

const audienceFields = {
  segmentId: z.string().nullable().optional(),
  internalSegment: internalSegmentSchema.optional(),
  sample: sampleSchema.optional(),
};

export const featureFlagVariantCreateBodySchema = FeatureFlagVariantScalarInputSchema.omit({
  featureFlagId: true,
  segmentId: true,
  deletedAt: true,
})
  .partial({ position: true })
  .extend(audienceFields);

export const featureFlagVariantUpdateBodySchema = FeatureFlagVariantScalarInputSchema.omit({
  featureFlagId: true,
  segmentId: true,
  deletedAt: true,
})
  .partial()
  .extend(audienceFields);

export const featureFlagValueSchema = z.object({
  ownerModel: z.enum(ProviderModel),
  ownerId: z.string(),
  customerModel: z.enum(CustomerModel),
  customerId: z.string(),
  slug: z.string(),
  valueType: FeatureFlagScalarSchema.shape.valueType,
  value: z.unknown().nullable(),
});
