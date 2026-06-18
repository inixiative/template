/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry
 * @uses feature:tenancy
 */
import type { InquiryAppEvents } from '#/modules/inquiry/handlers/types';

export const inviteOrganizationUserAppEvents: InquiryAppEvents = {
  sent: {
    email: (inquiry) => {
      if (!inquiry.targetUserId) return null;
      return [
        {
          template: 'inquiry-invite-organization-user',
          data: { inquiryId: inquiry.id },
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
