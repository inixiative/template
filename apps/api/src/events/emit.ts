import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { getHandlers } from '#/events/registry';
import type { AppEventOptions, AppEventPayload, AppEventType } from '#/events/types';
import { auditActorContext, nullAuditActor } from '#/lib/auditActorContext';

export const createAppEvent = async (
  type: AppEventType,
  data: Record<string, unknown>,
  options?: AppEventOptions,
  meta?: unknown,
): Promise<void> => {
  const actor = auditActorContext.getScope() ?? nullAuditActor;

  const event: AppEventPayload & { _meta?: unknown } = {
    type,
    actor,
    ...options,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta !== undefined) event._meta = meta;

  const eventHandlers = getHandlers(type);

  if (!eventHandlers.length) return;

  const runHandlers = async (): Promise<void> => {
    const results = await Promise.allSettled(eventHandlers.map((h) => h(event)));

    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        log.error(`App event handler failed [${type}] handler=${i}`, { error: result.reason });
      }
    }
  };

  if (db.isInTxn()) {
    db.onCommit(runHandlers);
  } else {
    await runHandlers();
  }
};
