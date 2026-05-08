import { deliverEmailHandoffs } from '#/appEvents/bridges/email';
import { deliverWSHandoffs } from '#/appEvents/bridges/websocket';
import type { AppEventHandlerDefinition, AppEventPayload } from '#/appEvents/types';
import { observeRegistry } from '#/lib/observe';

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

    // Wrap each bridge in an async IIFE so a synchronous throw from the
    // user-supplied selector (handler.observe(data) etc.) becomes a Promise
    // rejection captured by Promise.allSettled below — otherwise it would
    // bubble before sibling bridges enqueue, breaking bridge isolation.
    if (handler.observe) {
      tasks.push(
        (async () => {
          const observeData = handler.observe!(data);
          if (observeData) {
            await observeRegistry.broadcast((adapter) => adapter.record(event, observeData));
          }
        })(),
      );
    }

    if (handler.email) {
      tasks.push(
        (async () => {
          const handoffs = handler.email!(data);
          if (handoffs?.length) {
            await Promise.all(handoffs.map((h) => deliverEmailHandoffs(event, [h])));
          }
        })(),
      );
    }

    if (handler.websocket) {
      tasks.push(
        (async () => {
          const handoffs = handler.websocket!(data);
          if (handoffs?.length) {
            await Promise.all(handoffs.map((h) => deliverWSHandoffs([h])));
          }
        })(),
      );
    }

    if (handler.cb) {
      for (const callback of handler.cb) {
        tasks.push(Promise.resolve().then(() => callback(data)));
      }
    }

    const results = await Promise.allSettled(tasks);
    throwIfFailures(results.filter((result) => result.status === 'rejected').map((result) => result.reason));
  };
};
