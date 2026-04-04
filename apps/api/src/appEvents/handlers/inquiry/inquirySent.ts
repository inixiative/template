import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export type InquirySentPayload = Inquiry;

export const inquirySent = makeAppEvent<InquirySentPayload>({
  email: (inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];
    return handler?.appEvents?.sent?.email?.(inquiry) ?? null;
  },
  websocket: (inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];
    return handler?.appEvents?.sent?.websocket?.(inquiry) ?? null;
  },
  observe: (inquiry) => ({
    inquiryId: inquiry.id,
    type: inquiry.type,
    sourceOrganizationId: inquiry.sourceOrganizationId,
    targetUserId: inquiry.targetUserId,
    targetModel: inquiry.targetModel,
  }),
});
