import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

type InquiryResolvedData = Inquiry & { _resolution: 'approved' | 'denied' | 'changesRequested' };

makeAppEvent<InquiryResolvedData>('inquiry.resolved', {
  email: (data) => {
    const handler = inquiryHandlers[data.type as keyof typeof inquiryHandlers];
    const resolution = data._resolution;

    if (resolution === 'approved') return handler?.appEvents?.approved?.email?.(data) ?? null;
    if (resolution === 'denied') return handler?.appEvents?.denied?.email?.(data) ?? null;
    return null;
  },
  websocket: (data) => {
    const handler = inquiryHandlers[data.type as keyof typeof inquiryHandlers];
    return handler?.appEvents?.resolved?.websocket?.(data) ?? null;
  },
});
