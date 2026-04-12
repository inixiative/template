import { deliverEmailHandoffs } from '#/appEvents/bridges/email';
import { deliverWSHandoffs } from '#/appEvents/bridges/websocket';
import { observeRegistry } from '#/lib/observe';
import type { AppEventHandlerDefinition, AppEventPayload } from '#/appEvents/types';

export type AppEventHandlerFn = (event: AppEventPayload) => Promise<void>;

const isolate = <R>(fn: () => R | Promise<R>): Promise<R> => Promise.resolve().then(fn);

export const makeAppEvent = <T>(handler: AppEventHandlerDefinition<T>): AppEventHandlerFn => {
  return async (event: AppEventPayload) => {
    const data = event.data as T;
    const tasks: Promise<unknown>[] = [];

    if (handler.observe) {
      tasks.push(
        isolate(() => handler.observe!(data)).then((observeData) => {
          if (observeData) return observeRegistry.broadcast((adapter) => adapter.record(event, observeData));
        }),
      );
    }

    if (handler.email) {
      tasks.push(
        isolate(() => handler.email!(data)).then((handoffs) => {
          if (handoffs?.length) return Promise.all(handoffs.map((h) => deliverEmailHandoffs(event, [h])));
        }),
      );
    }

    if (handler.websocket) {
      tasks.push(
        isolate(() => handler.websocket!(data)).then((handoffs) => {
          if (handoffs?.length) return Promise.all(handoffs.map((h) => deliverWSHandoffs([h])));
        }),
      );
    }

    if (handler.cb) {
      for (const callback of handler.cb) {
        tasks.push(isolate(() => callback(data)));
      }
    }

    await Promise.allSettled(tasks);
  };
};
