/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:inquiry
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryServices } from '#/modules/inquiry/services';
import type { InquiryWithIncludes } from '#/modules/inquiry/services/types';

export type InquirySentPayload = InquiryWithIncludes;

export const inquirySent = makeAppEvent<InquirySentPayload>({
  email: (inquiry) => inquiryServices[inquiry.type]?.appEvents?.sent?.email?.(inquiry) ?? null,
  websocket: (inquiry) =>
    inquiryServices[inquiry.type]?.appEvents?.sent?.websocket?.(inquiry) ?? null,
});
