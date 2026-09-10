/**
 * @atlas
 * @kind schema
 * @partOf feature:segment
 * @uses feature:customer
 */
import { z } from '@hono/zod-openapi';
import { SegmentMemberScalarSchema, SegmentScalarInputSchema, SegmentScalarSchema } from '@template/db';
import { customerRefAsProviderSchema } from '#/modules/customerRef/schemas/customerRefSchemas';
import { selectSegmentForCustomer } from '#/modules/segment/queries/segmentIncludes';

export const SEGMENT_CREATE_IMMUTABLE_FIELDS = ['ownerModel', 'userId', 'organizationId', 'spaceId'] as const;

export const segmentCreateBodySchema = SegmentScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
  deletedAt: true,
});

export const segmentUpdateBodySchema = segmentCreateBodySchema.partial();

export const ruleIssueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('binding'), name: z.string(), detail: z.string() }),
  z.object({ kind: z.literal('vocabulary'), detail: z.string() }),
  z.object({
    kind: z.literal('reference'),
    reference: z.object({ model: z.string(), id: z.string() }),
    detail: z.string(),
  }),
]);

export const segmentReadResponseSchema = SegmentScalarSchema.extend({ ruleIssues: z.array(ruleIssueSchema) });

export const segmentMemberWithCustomerSchema = SegmentMemberScalarSchema.extend({
  customerRef: customerRefAsProviderSchema,
});

export const segmentMembershipSchema = SegmentMemberScalarSchema.extend({
  segment: SegmentScalarSchema.pick(selectSegmentForCustomer),
});
