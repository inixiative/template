import { contentSchema } from '#/modules/inquiry/handlers/inviteOrganizationUser';
import type { InquiryAppEvents } from '#/modules/inquiry/handlers/types';

export const inviteOrganizationUserAppEvents: InquiryAppEvents = {
  sent: {
    email: (inquiry) => {
      if (!inquiry.targetUserId) return null;
      const content = contentSchema.parse(inquiry.content);
      const invitationUrl = `${process.env.WEB_URL ?? ''}/invitations/${inquiry.id}`;
      return [
        {
          to: [{ userIds: [inquiry.targetUserId] }],
          template: 'org-invitation',
          data: {
            role: content.role,
            buttonUrl: invitationUrl,
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
          message: { data: { event: 'inquiry.sent', inquiryId: inquiry.id, type: inquiry.type } },
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
          message: { data: { event: 'inquiry.resolved', inquiryId: inquiry.id, type: inquiry.type, status: inquiry.status } },
        },
      ];
    },
  },
};
