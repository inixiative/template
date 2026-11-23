/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry
 * @uses feature:tenancy
 */
import { refetchQueryEvent, WS_CHANNELS } from '@template/shared/ws';
import type { WSHandoff } from '#/appEvents/types';
import type { InquiryAppEvents } from '#/modules/inquiry/services/types';

// Refetch the inquiry's read query on every subscribed client. The channel comes from the
// shared registry — the same derivation the client subscribes with — and a refetch WSEvent
// rides as the handoff's message payload.
const refetchInquiry = (id: string): WSHandoff => {
  return {
    kind: 'channels',
    target: { channels: [WS_CHANNELS.inquiryRead.name(id)] },
    message: { data: refetchQueryEvent({ _id: 'inquiryRead', path: { id } }) },
  };
};

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
    websocket: (inquiry) => [refetchInquiry(inquiry.id)],
  },
  resolved: {
    websocket: (inquiry) => [refetchInquiry(inquiry.id)],
  },
};
