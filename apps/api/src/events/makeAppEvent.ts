import type { z } from 'zod';
import { createAppEvent } from '#/events/emit';
import { registerAppEvent } from '#/events/registry';
import type {
  AppEventOptions,
  AppEventPayload,
  EmailHandoff,
  WSHandoff,
} from '#/events/types';

type AppEventDefinition<T> = {
  type: string;
  schema: z.ZodType<T>;
  email?: (event: AppEventPayload<T>) => Promise<EmailHandoff[] | null>;
  websocket?: (event: AppEventPayload<T>) => Promise<WSHandoff[] | null>;
  on?: Array<(event: AppEventPayload<T>) => Promise<void> | void>;
};

type AppEvent<T> = {
  type: string;
  schema: z.ZodType<T>;
  emit: (data: T, options?: AppEventOptions) => Promise<void>;
};

export const makeAppEvent = <T>(def: AppEventDefinition<T>): AppEvent<T> => {
  if (def.email) {
    const emailCallback = def.email;
    registerAppEvent(def.type, async (event) => {
      const { deliverEmailHandoffs } = await import('#/events/bridges/email');
      const handoffs = await emailCallback(event as AppEventPayload<T>);
      if (!handoffs?.length) return;
      await deliverEmailHandoffs(event, handoffs);
    });
  }

  if (def.websocket) {
    const wsCallback = def.websocket;
    registerAppEvent(def.type, async (event) => {
      const { deliverWSHandoffs } = await import('#/events/bridges/websocket');
      const handoffs = await wsCallback(event as AppEventPayload<T>);
      if (!handoffs?.length) return;
      await deliverWSHandoffs(handoffs);
    });
  }

  if (def.on) {
    for (const callback of def.on) {
      registerAppEvent(def.type, (event) => callback(event as AppEventPayload<T>));
    }
  }

  return {
    type: def.type,
    schema: def.schema,
    emit: async (data: T, options?: AppEventOptions) => {
      const parsed = def.schema.parse(data);
      await createAppEvent(def.type, parsed as Record<string, unknown>, options);
    },
  };
};
