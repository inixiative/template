/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma, feature:inquiry, feature:segment, feature:webhooks
 */
import { type AccessorName, Prisma } from '@template/db';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { includeSegmentRuleReferences } from '#/modules/segment/queries/segmentIncludes';

// Custom args for specific models (inclusions, selects, etc.)
// Other models use default findMany with no extra args
export const resourceContextArgs: Partial<Record<AccessorName, object>> = {
  inquiry: { include: includeInquiryResponse },
  segment: { include: includeSegmentRuleReferences },
  webhookSubscription: {
    include: {
      webhookEvents: { take: 10, orderBy: { createdAt: Prisma.SortOrder.desc } },
    },
  },
};

export type ResourcePayloadMap = {
  inquiry: Prisma.InquiryGetPayload<{ include: typeof includeInquiryResponse }>;
  segment: Prisma.SegmentGetPayload<{ include: typeof includeSegmentRuleReferences }>;
  webhookSubscription: Prisma.WebhookSubscriptionGetPayload<{
    include: { webhookEvents: { take: 10; orderBy: { createdAt: 'desc' } } };
  }>;
};
