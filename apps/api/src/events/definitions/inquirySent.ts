import { z } from 'zod';
import { makeAppEvent } from '#/events/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';

export const inquirySentEvent = makeAppEvent({
  type: 'inquiry.sent',
  schema: z.object({
    inquiryId: z.string(),
    inquiryType: z.string(),
    sourceOrganizationId: z.string().optional(),
    sourceUserId: z.string().optional(),
    targetUserId: z.string().optional(),
    targetModel: z.string(),
    inquiry: z.record(z.unknown()),
  }),
  email: async (event) => {
    const handler = inquiryHandlers[event.data.inquiryType as keyof typeof inquiryHandlers];
    if (!handler?.onSent) return null;
    return handler.onSent(event.data.inquiry as never) ?? null;
  },
  websocket: async (event) => {
    const handler = inquiryHandlers[event.data.inquiryType as keyof typeof inquiryHandlers];
    if (!handler?.onSentWS) return null;
    return handler.onSentWS(event.data.inquiry as never) ?? null;
  },
});
