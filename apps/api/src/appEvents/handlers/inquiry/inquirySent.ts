import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { InquiryWithIncludes } from '#/modules/inquiry/handlers/types';

export type InquirySentPayload = InquiryWithIncludes;

export const inquirySent = makeAppEvent<InquirySentPayload>({
  email: (inquiry) => inquiryHandlers[inquiry.type]?.appEvents?.sent?.email?.(inquiry) ?? null,
  websocket: (inquiry) => inquiryHandlers[inquiry.type]?.appEvents?.sent?.websocket?.(inquiry) ?? null,
  observe: (inquiry) => ({
    inquiryId: inquiry.id,
    type: inquiry.type,
    status: inquiry.status,
    sourceOrganizationId: inquiry.sourceOrganizationId,
    targetUserId: inquiry.targetUserId,
    targetModel: inquiry.targetModel,
  }),
});
