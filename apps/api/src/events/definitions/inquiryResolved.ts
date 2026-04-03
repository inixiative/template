import { z } from 'zod';
import { makeAppEvent } from '#/events/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const inquiryResolvedEvent = makeAppEvent<
  {
    inquiryId: string;
    inquiryType: string;
    resolution: 'approved' | 'denied' | 'changesRequested';
    sourceOrganizationId?: string;
    sourceUserId?: string;
    targetUserId?: string;
  },
  Inquiry
>({
  type: 'inquiry.resolved',
  schema: z.object({
    inquiryId: z.string(),
    inquiryType: z.string(),
    resolution: z.enum(['approved', 'denied', 'changesRequested']),
    sourceOrganizationId: z.string().optional(),
    sourceUserId: z.string().optional(),
    targetUserId: z.string().optional(),
  }),
  email: async (event, inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];

    if (event.data.resolution === 'approved' && handler?.onApproved) {
      return handler.onApproved(inquiry) ?? null;
    }
    if (event.data.resolution === 'denied' && handler?.onDenied) {
      return handler.onDenied(inquiry) ?? null;
    }
    return null;
  },
  websocket: async (_event, inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];
    if (!handler?.onResolvedWS) return null;
    return handler.onResolvedWS(inquiry) ?? null;
  },
});
