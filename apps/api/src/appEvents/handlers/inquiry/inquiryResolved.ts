import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

export type InquiryResolvedPayload = Inquiry & { _resolution: 'approved' | 'denied' | 'changesRequested' };

makeAppEvent<InquiryResolvedPayload>('inquiry.resolved', {
  email: (data) => {
    const handler = inquiryHandlers[data.type as keyof typeof inquiryHandlers];

    if (data._resolution === 'approved') return handler?.appEvents?.approved?.email?.(data) ?? null;
    if (data._resolution === 'denied') return handler?.appEvents?.denied?.email?.(data) ?? null;
    return null;
  },
  websocket: (data) => {
    const handler = inquiryHandlers[data.type as keyof typeof inquiryHandlers];
    return handler?.appEvents?.resolved?.websocket?.(data) ?? null;
  },
});
