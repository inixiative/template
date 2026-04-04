import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { InquiryWithReceivedIncludes } from '#/modules/inquiry/handlers/types';

export type InquiryResolvedPayload = InquiryWithReceivedIncludes & { _resolution: 'approved' | 'denied' | 'changesRequested' };

const getLifecycleHandlers = (data: InquiryResolvedPayload) => {
  const handler = inquiryHandlers[data.type];
  if (!handler?.appEvents) return null;

  if (data._resolution === 'approved') return handler.appEvents.approved;
  if (data._resolution === 'denied') return handler.appEvents.denied;
  if (data._resolution === 'changesRequested') return handler.appEvents.changesRequested;
  return null;
};

export const inquiryResolved = makeAppEvent<InquiryResolvedPayload>({
  email: (data) => getLifecycleHandlers(data)?.email?.(data) ?? null,
  websocket: (data) => inquiryHandlers[data.type]?.appEvents?.resolved?.websocket?.(data) ?? null,
  observe: (data) => ({
    inquiryId: data.id,
    type: data.type,
    resolution: data._resolution,
    sourceOrganizationId: data.sourceOrganizationId,
    targetUserId: data.targetUserId,
  }),
});
