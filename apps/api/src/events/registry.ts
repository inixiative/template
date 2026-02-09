import type { AppEventHandler, AppEventType } from '#/events/types';

const handlers: Map<AppEventType | '*', AppEventHandler[]> = new Map();

export const registerAppEvent = (type: AppEventType | '*', handler: AppEventHandler): void => {
  const existing = handlers.get(type) ?? [];
  handlers.set(type, [...existing, handler]);
};

export const getHandlers = (type: AppEventType): AppEventHandler[] => {
  const specific = handlers.get(type) ?? [];
  const global = handlers.get('*') ?? [];
  return [...specific, ...global];
};

export const clearHandlers = (): void => {
  handlers.clear();
};
