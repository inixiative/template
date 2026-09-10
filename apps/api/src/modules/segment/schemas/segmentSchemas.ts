/**
 * @atlas
 * @kind schema
 * @partOf feature:segment
 * @uses feature:customer
 */
import { SegmentMemberScalarSchema, SegmentScalarInputSchema, SegmentScalarSchema } from '@template/db';
import { customerRefAsProviderSchema } from '#/modules/customerRef/schemas/customerRefSchemas';
import { selectSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';

export const SEGMENT_CREATE_IMMUTABLE_FIELDS = [
  'ownerModel',
  'userId',
  'organizationId',
  'spaceId',
  'reconcilePausedAt',
  'reconcilePausedReason',
  'reconcilePausedDetail',
] as const;

export const segmentCreateBodySchema = SegmentScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
  reconcilePausedAt: true,
  reconcilePausedReason: true,
  reconcilePausedDetail: true,
  deletedAt: true,
});

export const segmentUpdateBodySchema = segmentCreateBodySchema.partial();

export const segmentReadResponseSchema = SegmentScalarSchema;

export const segmentMemberWithCustomerSchema = SegmentMemberScalarSchema.extend({
  customerRef: customerRefAsProviderSchema,
});

export const segmentMembershipSchema = SegmentMemberScalarSchema.extend({
  segment: SegmentScalarSchema.pick(selectSegmentForCustomer),
});
