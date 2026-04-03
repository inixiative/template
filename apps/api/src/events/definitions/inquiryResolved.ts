import { z } from 'zod';
import { makeAppEvent } from '#/events/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';

export const inquiryResolvedEvent = makeAppEvent({
  type: 'inquiry.resolved',
  schema: z.object({
    inquiryId: z.string(),
    inquiryType: z.string(),
    resolution: z.enum(['approved', 'denied', 'changesRequested']),
    sourceOrganizationId: z.string().optional(),
    sourceUserId: z.string().optional(),
    targetUserId: z.string().optional(),
    inquiry: z.record(z.unknown()),
  }),
  email: async (event) => {
    const handler = inquiryHandlers[event.data.inquiryType as keyof typeof inquiryHandlers];
    const resolution = event.data.resolution;

    if (resolution === 'approved' && handler?.onApproved) {
      return handler.onApproved(event.data.inquiry as never) ?? null;
    }
    if (resolution === 'denied' && handler?.onDenied) {
      return handler.onDenied(event.data.inquiry as never) ?? null;
    }
    return null;
  },
  websocket: async (event) => {
    const handler = inquiryHandlers[event.data.inquiryType as keyof typeof inquiryHandlers];
    if (!handler?.onResolvedWS) return null;
    return handler.onResolvedWS(event.data.inquiry as never) ?? null;
  },
});
