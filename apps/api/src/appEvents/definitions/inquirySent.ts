import { z } from 'zod';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export const inquirySentEvent = makeAppEvent<
  {
    inquiryId: string;
    inquiryType: string;
    sourceOrganizationId?: string;
    sourceUserId?: string;
    targetUserId?: string;
    targetModel: string;
  },
  Inquiry
>({
  type: 'inquiry.sent',
  schema: z.object({
    inquiryId: z.string(),
    inquiryType: z.string(),
    sourceOrganizationId: z.string().optional(),
    sourceUserId: z.string().optional(),
    targetUserId: z.string().optional(),
    targetModel: z.string(),
  }),
  email: async (_event, inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];
    if (!handler?.onSent) return null;
    return handler.onSent(inquiry) ?? null;
  },
  websocket: async (_event, inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];
    if (!handler?.onSentWS) return null;
    return handler.onSentWS(inquiry) ?? null;
  },
});
