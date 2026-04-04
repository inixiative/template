import { dbObserveAdapter } from '#/appEvents/services/observe/dbAdapter';
import type { AppEventHandlerDefinition, AppEventPayload } from '#/appEvents/types';

export type AppEventHandlerFn = (event: AppEventPayload) => Promise<void>;

export const makeAppEvent = <T>(handler: AppEventHandlerDefinition<T>): AppEventHandlerFn => {
  return async (event: AppEventPayload) => {
    const data = event.data as T;
    const tasks: Promise<void>[] = [];

    if (handler.observe) {
      const observeData = handler.observe(data);
      if (observeData) tasks.push(dbObserveAdapter.record(event, observeData));
    }

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
  };
};
