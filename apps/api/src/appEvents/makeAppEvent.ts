import { registerAppEvent } from '#/appEvents/registry';
import type { AppEventHandlerDefinition } from '#/appEvents/types';

export const makeAppEvent = <T>(name: string, handler: AppEventHandlerDefinition<T>): void => {
  registerAppEvent(name, async (event) => {
    const data = event.data as T;
    const tasks: Promise<void>[] = [];

    if (handler.email) {
      const handoffs = handler.email(data);
      if (handoffs?.length) {
        const { deliverEmailHandoffs } = await import('#/appEvents/bridges/email');
        tasks.push(deliverEmailHandoffs(event, handoffs));
      }
    }

    if (handler.websocket) {
      const handoffs = handler.websocket(data);
      if (handoffs?.length) {
        const { deliverWSHandoffs } = await import('#/appEvents/bridges/websocket');
        tasks.push(deliverWSHandoffs(handoffs));
      }
    }

    if (handler.on) {
      for (const callback of handler.on) {
        tasks.push(Promise.resolve(callback(data)));
      }
    }

    await Promise.all(tasks);
  });
};
