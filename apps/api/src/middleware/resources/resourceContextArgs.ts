import { type AccessorName, Prisma } from '@template/db';

// Custom args for specific models (inclusions, selects, etc.)
// Other models use default findMany with no extra args
export const resourceContextArgs: Partial<Record<AccessorName, object>> = {
  inquiry: {
    include: {
      sourceUser: true,
      sourceOrganization: true,
      sourceSpace: true,
      targetUser: true,
      targetOrganization: true,
      targetSpace: true,
    }
  },
  webhookSubscription: {
    include: {
      webhookEvents: { take: 10, orderBy: { createdAt: Prisma.SortOrder.desc } },
    },
  },
};

export type ResourcePayloadMap = {
  inquiry: Prisma.InquiryGetPayload<{
    include: {
      sourceUser: true,
      sourceOrganization: true,
      sourceSpace: true,
      targetUser: true,
      targetOrganization: true,
      targetSpace: true,
    }
  }>;
  webhookSubscription: Prisma.WebhookSubscriptionGetPayload<{
    include: { webhookEvents: { take: 10; orderBy: { createdAt: 'desc' } } };
  }>;
};
