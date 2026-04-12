import { contentSchema } from '#/modules/inquiry/handlers/inviteOrganizationUser';
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
    websocket: (inquiry) => {
      if (!inquiry.targetUserId) return null;
      return [
        {
          target: { userIds: [inquiry.targetUserId] },
          message: {
            type: 'inquiry.sent',
            data: { inquiryId: inquiry.id, inquiryType: inquiry.type },
          },
        },
      ];
    },
  },
  resolved: {
    websocket: (inquiry) => {
      const targets: string[] = [];
      if (inquiry.sourceUserId) targets.push(inquiry.sourceUserId);
      if (inquiry.targetUserId) targets.push(inquiry.targetUserId);
      if (!targets.length) return null;
      return [
        {
          target: { userIds: targets },
          message: {
            type: 'inquiry.resolved',
            data: { inquiryId: inquiry.id, inquiryType: inquiry.type, status: inquiry.status },
          },
        },
      ];
    },
  },
};
