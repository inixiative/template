import type { AppEventHandler, AppEventName } from '#/appEvents/types';

const handlers: Map<AppEventName | '*', AppEventHandler[]> = new Map();

export const registerAppEvent = (name: AppEventName | '*', handler: AppEventHandler): void => {
  const existing = handlers.get(name) ?? [];
  handlers.set(name, [...existing, handler]);
};

export const getHandlers = (name: AppEventName): AppEventHandler[] => {
  const specific = handlers.get(name) ?? [];
  const global = handlers.get('*') ?? [];
  return [...specific, ...global];
};

export const clearHandlers = (): void => {
  handlers.clear();
};
