import { registerAppEvent } from '#/appEvents/registry';
import type {
  AppEventHandlerDefinition,
  AppEventPayload,
} from '#/appEvents/types';

export const makeAppEvent = <T>(name: string, handler: AppEventHandlerDefinition<T>): void => {
  if (handler.email) {
    const emailCallback = handler.email;
    registerAppEvent(name, async (event) => {
      const { deliverEmailHandoffs } = await import('#/appEvents/bridges/email');
      const handoffs = emailCallback(event.data as T);
      if (!handoffs?.length) return;
      await deliverEmailHandoffs(event, handoffs);
    });
  }

  if (handler.websocket) {
    const wsCallback = handler.websocket;
    registerAppEvent(name, async (event) => {
      const { deliverWSHandoffs } = await import('#/appEvents/bridges/websocket');
      const handoffs = wsCallback(event.data as T);
      if (!handoffs?.length) return;
      await deliverWSHandoffs(handoffs);
    });
  }

  if (handler.on) {
    for (const callback of handler.on) {
      registerAppEvent(name, (event) => callback(event.data as T));
    }
  }
};
