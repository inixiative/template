import type { z } from 'zod';
import { createAppEvent } from '#/events/emit';
import { registerAppEvent } from '#/events/registry';
import type {
  AppEventOptions,
  AppEventPayload,
  EmailHandoff,
  WSHandoff,
} from '#/events/types';

type AppEventDefinition<T, M = undefined> = {
  type: string;
  schema: z.ZodType<T>;
  email?: (event: AppEventPayload<T>, meta: M) => Promise<EmailHandoff[] | null>;
  websocket?: (event: AppEventPayload<T>, meta: M) => Promise<WSHandoff[] | null>;
  on?: Array<(event: AppEventPayload<T>, meta: M) => Promise<void> | void>;
};

type EmitOptions = AppEventOptions & {
  /** Opaque context passed to bridge callbacks but NOT persisted to the event store. */
  meta?: unknown;
};

type AppEvent<T, M = undefined> = {
  type: string;
  schema: z.ZodType<T>;
  emit: (data: T, options?: M extends undefined ? EmitOptions : EmitOptions & { meta: M }) => Promise<void>;
};

export const makeAppEvent = <T, M = undefined>(def: AppEventDefinition<T, M>): AppEvent<T, M> => {
  if (def.email) {
    const emailCallback = def.email;
    registerAppEvent(def.type, async (event) => {
      const { deliverEmailHandoffs } = await import('#/events/bridges/email');
      const meta = (event as AppEventPayload & { _meta?: unknown })._meta as M;
      const handoffs = await emailCallback(event as AppEventPayload<T>, meta);
      if (!handoffs?.length) return;
      await deliverEmailHandoffs(event, handoffs);
    });
  }

  if (def.websocket) {
    const wsCallback = def.websocket;
    registerAppEvent(def.type, async (event) => {
      const { deliverWSHandoffs } = await import('#/events/bridges/websocket');
      const meta = (event as AppEventPayload & { _meta?: unknown })._meta as M;
      const handoffs = await wsCallback(event as AppEventPayload<T>, meta);
      if (!handoffs?.length) return;
      await deliverWSHandoffs(handoffs);
    });
  }

  if (def.on) {
    for (const callback of def.on) {
      registerAppEvent(def.type, (event) => {
        const meta = (event as AppEventPayload & { _meta?: unknown })._meta as M;
        return callback(event as AppEventPayload<T>, meta);
      });
    }
  }

  return {
    type: def.type,
    schema: def.schema,
    emit: async (data: T, options?: EmitOptions & { meta?: M }) => {
      const parsed = def.schema.parse(data);
      const { meta, ...eventOptions } = options ?? {};
      await createAppEvent(def.type, parsed as Record<string, unknown>, eventOptions, meta);
    },
  } as AppEvent<T, M>;
};
