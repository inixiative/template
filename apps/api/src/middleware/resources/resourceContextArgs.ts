import { type AccessorName, Prisma } from '@template/db';
import { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';

// Custom args for specific models (inclusions, selects, etc.)
// Other models use default findMany with no extra args
export const resourceContextArgs: Partial<Record<AccessorName, object>> = {
  inquiry: { include: includeInquiryResponse },
  webhookSubscription: {
    include: {
      webhookEvents: { take: 10, orderBy: { createdAt: Prisma.SortOrder.desc } },
    },
  },
};

export type ResourcePayloadMap = {
  inquiry: Prisma.InquiryGetPayload<{ include: typeof includeInquiryResponse }>;
  webhookSubscription: Prisma.WebhookSubscriptionGetPayload<{
    include: { webhookEvents: { take: 10; orderBy: { createdAt: 'desc' } } };
  }>;
};
