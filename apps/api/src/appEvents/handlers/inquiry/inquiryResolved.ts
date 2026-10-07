/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:inquiry
 */
import { InquiryStatus } from '@template/db/generated/client/enums';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { InquiryWithIncludes } from '#/modules/inquiry/handlers/types';

export type InquiryResolvedPayload = InquiryWithIncludes;

const getLifecycleHandlers = (data: InquiryResolvedPayload) => {
  const handler = inquiryHandlers[data.type];
  if (!handler?.appEvents) return null;

  if (data.status === InquiryStatus.approved) return handler.appEvents.approved;
  if (data.status === InquiryStatus.denied) return handler.appEvents.denied;
  if (data.status === InquiryStatus.changesRequested) return handler.appEvents.changesRequested;
  return null;
};

export const inquiryResolved = makeAppEvent<InquiryResolvedPayload>({
  email: (data) => getLifecycleHandlers(data)?.email?.(data) ?? null,
  websocket: (data) => inquiryHandlers[data.type]?.appEvents?.resolved?.websocket?.(data) ?? null,
});
