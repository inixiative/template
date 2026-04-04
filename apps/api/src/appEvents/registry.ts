import type { AppEventHandler } from '#/appEvents/types';

const handlers: Map<string, AppEventHandler[]> = new Map();

export const registerAppEvent = (name: string, handler: AppEventHandler): void => {
  const existing = handlers.get(name) ?? [];
  handlers.set(name, [...existing, handler]);
};

export const getHandlers = (name: string): AppEventHandler[] => {
  const specific = handlers.get(name) ?? [];
  const global = handlers.get('*') ?? [];
  return [...specific, ...global];
};

export const clearHandlers = (): void => {
  handlers.clear();
};
