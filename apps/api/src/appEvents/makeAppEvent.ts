import { deliverEmailHandoffs } from '#/appEvents/bridges/email';
import { deliverWSHandoffs } from '#/appEvents/bridges/websocket';
import { observeRegistry } from '#/lib/observe';
import type { AppEventHandlerDefinition, AppEventPayload } from '#/appEvents/types';

export type AppEventHandlerFn = (event: AppEventPayload) => Promise<void>;

const throwIfFailures = (errors: unknown[]): void => {
  if (errors.length === 0) return;

  if (errors.length === 1) {
    const error = errors[0];
    throw error instanceof Error ? error : new Error(String(error));
  }

  throw new AggregateError(errors, `${errors.length} app event bridge failures`);
};

export const makeAppEvent = <T>(handler: AppEventHandlerDefinition<T>): AppEventHandlerFn => {
  return async (event: AppEventPayload) => {
    const data = event.data as T;
    const tasks: Promise<void>[] = [];

    if (handler.observe) {
      const observeData = handler.observe(data);
      if (observeData) {
        tasks.push(observeRegistry.broadcast((adapter) => adapter.record(event, observeData)).then(() => {}));
      }
    }

    if (handler.email) {
      const handoffs = handler.email(data);
      if (handoffs?.length) {
        for (const handoff of handoffs) {
          tasks.push(deliverEmailHandoffs(event, [handoff]));
        }
      }
    }

    if (handler.websocket) {
      const handoffs = handler.websocket(data);
      if (handoffs?.length) {
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

    const results = await Promise.allSettled(tasks);
    throwIfFailures(results.filter((result) => result.status === 'rejected').map((result) => result.reason));
  };
};
