import { observeRegistry } from '#/appEvents/services/observe';
import type { AppEventHandlerDefinition, AppEventPayload } from '#/appEvents/types';

export type AppEventHandlerFn = (event: AppEventPayload) => Promise<void>;

export const makeAppEvent = <T>(handler: AppEventHandlerDefinition<T>): AppEventHandlerFn => {
  return async (event: AppEventPayload) => {
    const data = event.data as T;
    const tasks: Promise<void>[] = [];

    if (handler.observe) {
      const observeData = handler.observe(data);
      if (observeData) {
        tasks.push(
          observeRegistry.broadcast((adapter) => adapter.record(event, observeData)).then(() => {}),
        );
      }
    }

    if (handler.email) {
      const handoffs = handler.email(data);
      if (handoffs?.length) {
        const { deliverEmailHandoffs } = await import('#/appEvents/bridges/email');
        for (const handoff of handoffs) {
          tasks.push(deliverEmailHandoffs(event, [handoff]));
        }
      }
    }

    if (handler.websocket) {
      const handoffs = handler.websocket(data);
      if (handoffs?.length) {
        const { deliverWSHandoffs } = await import('#/appEvents/bridges/websocket');
        for (const handoff of handoffs) {
          tasks.push(deliverWSHandoffs([handoff]));
        }
      }
    }

    if (handler.cb) {
      for (const callback of handler.cb) {
        tasks.push(Promise.resolve(callback(data)));
      }
    }

    await Promise.all(tasks);
  };
};
