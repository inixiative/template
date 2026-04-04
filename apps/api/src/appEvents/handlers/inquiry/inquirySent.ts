import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import type { Inquiry } from '#/modules/inquiry/handlers/types';

makeAppEvent<Inquiry>('inquiry.sent', {
  email: (inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];
    return handler?.appEvents?.sent?.email?.(inquiry) ?? null;
  },
  websocket: (inquiry) => {
    const handler = inquiryHandlers[inquiry.type as keyof typeof inquiryHandlers];
    return handler?.appEvents?.sent?.websocket?.(inquiry) ?? null;
  },
});
