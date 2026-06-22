/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry
 * @uses feature:tenancy
 */
import { channelKey, type WSEvent } from '@template/shared/ws';
import type { WSHandoff } from '#/appEvents/types';
import type { InquiryAppEvents } from '#/modules/inquiry/handlers/types';

// Refetch the inquiry's read query on every subscribed client. The query's channel
// is keyed by channelKey(queryKey) — the same derivation the client subscribes with —
// and a refetch WSEvent rides as the handoff's message payload.
const refetchInquiry = (id: string): WSHandoff => {
  const key = { _id: 'inquiryRead', path: { id } };
  const event: WSEvent = { category: 'query', action: 'refetch', key };
  return { target: { channels: [channelKey(key)] }, message: { data: event } };
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
