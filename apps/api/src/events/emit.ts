import { db } from '@template/db';
import { getHandlers } from '#/events/registry';
import type { AppEventOptions, AppEventPayload, AppEventType } from '#/events/types';

export const createAppEvent = async (
  type: AppEventType,
  data: Record<string, unknown>,
  options?: AppEventOptions,
): Promise<void> => {
  const event: AppEventPayload = {
    type,
    ...options,
    data,
    timestamp: new Date().toISOString(),
  };

  const eventHandlers = getHandlers(type);

  if (!eventHandlers.length) return;

  const runHandlers = async (): Promise<void> => {
    await Promise.all(eventHandlers.map((h) => h(event)));
  };

  if (db.isInTxn()) {
    db.onCommit(runHandlers);
  } else {
    await runHandlers();
  }
};
