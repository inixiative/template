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

    // Flatten each handoff into its own task so the outer Promise.allSettled
    // isolates per-handoff failures — one bad email recipient doesn't fail the
    // sibling emails for this event. A synchronous throw from the selector is
    // captured as a single rejection so it can't bubble before sibling bridges
    // enqueue.
    if (handler.email) {
      try {
        const handoffs = handler.email(data) ?? [];
        for (const h of handoffs) tasks.push(deliverEmailHandoffs(event, [h]));
      } catch (err) {
        tasks.push(Promise.reject(err));
      }
    }

    if (handler.websocket) {
      try {
        const handoffs = handler.websocket(data) ?? [];
        for (const h of handoffs) tasks.push(deliverWSHandoffs([h]));
      } catch (err) {
        tasks.push(Promise.reject(err));
      }
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
