/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma, feature:inquiry, feature:segment, feature:webhooks
 */
import { type AccessorName, includeTargetEntitlements, Prisma } from '@template/db';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';
import { includeSegmentRuleReferences } from '#/modules/segment/queries/segmentIncludes';

// Custom args for specific models (inclusions, selects, etc.)
// Other models use default findMany with no extra args
export const resourceContextArgs: Partial<Record<AccessorName, object>> = {
  inquiry: { include: includeInquiryResponse },
  token: { include: includeTargetEntitlements },
  integration: { include: includeTargetEntitlements },
  organizationUser: { include: includeTargetEntitlements },
  spaceUser: { include: includeTargetEntitlements },
  segment: { include: includeSegmentRuleReferences },
  webhookSubscription: {
    include: {
      webhookEvents: { take: 10, orderBy: { createdAt: Prisma.SortOrder.desc } },
    },
  },
};

export type ResourcePayloadMap = {
  token: Prisma.TokenGetPayload<{ include: typeof includeTargetEntitlements }>;
  integration: Prisma.IntegrationGetPayload<{ include: typeof includeTargetEntitlements }>;
  organizationUser: Prisma.OrganizationUserGetPayload<{
    include: typeof includeTargetEntitlements;
  }>;
  spaceUser: Prisma.SpaceUserGetPayload<{ include: typeof includeTargetEntitlements }>;
  inquiry: Prisma.InquiryGetPayload<{ include: typeof includeInquiryResponse }>;
  segment: Prisma.SegmentGetPayload<{ include: typeof includeSegmentRuleReferences }>;
  webhookSubscription: Prisma.WebhookSubscriptionGetPayload<{
    include: { webhookEvents: { take: 10; orderBy: { createdAt: 'desc' } } };
  }>;
};
