import { contentSchema } from '#/modules/inquiry/handlers/inviteOrganizationUser/schema';
import type { InquiryAppEvents } from '#/modules/inquiry/handlers/types';

export const inviteOrganizationUserAppEvents: InquiryAppEvents = {
  sent: {
    email: (inquiry) => {
      if (!inquiry.targetUserId) return null;
      const content = contentSchema.parse(inquiry.content);
      return [
        {
          to: [{ userIds: [inquiry.targetUserId] }],
          template: 'org-invitation',
          data: {
            organizationName: inquiry.sourceOrganization?.name ?? '',
            inviterName: inquiry.sourceUser?.name ?? '',
            role: content.role,
            buttonUrl: `${process.env.WEB_URL ?? ''}/invitations/${inquiry.id}`,
            buttonText: 'Accept Invitation',
          },
          sender: {
            ownerModel: 'Organization',
            organizationId: inquiry.sourceOrganizationId ?? undefined,
          },
          tags: ['inviteOrganizationUser'],
        },
      ];
    },
    websocket: (inquiry) => [
      { category: 'query', action: 'refetch', key: { _id: 'inquiryRead', path: { id: inquiry.id } } },
    ],
  },
  resolved: {
    websocket: (inquiry) => [
      { category: 'query', action: 'refetch', key: { _id: 'inquiryRead', path: { id: inquiry.id } } },
    ],
  },
};
