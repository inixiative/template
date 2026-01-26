import type { AppEventHandler, AppEventType } from '#/events/types';

const handlers: Map<AppEventType | '*', AppEventHandler[]> = new Map();

export function registerAppEvent(type: AppEventType | '*', handler: AppEventHandler): void {
  const existing = handlers.get(type) ?? [];
  handlers.set(type, [...existing, handler]);
}

export function getHandlers(type: AppEventType): AppEventHandler[] {
  const specific = handlers.get(type) ?? [];
  const global = handlers.get('*') ?? [];
  return [...specific, ...global];
}

export function clearHandlers(): void {
  handlers.clear();
}
