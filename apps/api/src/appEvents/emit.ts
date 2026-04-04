import { db } from '@template/db';
import { log } from '@template/shared/logger';
import type { AppEventPayloads } from '#/appEvents/handlers';
import { getHandlers } from '#/appEvents/registry';
import type { AppEventOptions, AppEventPayload } from '#/appEvents/types';
import { auditActorContext, nullAuditActor } from '#/lib/auditActorContext';

export const emitAppEvent = async <K extends keyof AppEventPayloads>(
  name: K,
  data: AppEventPayloads[K],
  options?: AppEventOptions,
): Promise<void> => {
  const actor = auditActorContext.getScope() ?? nullAuditActor;

  const event: AppEventPayload = {
    name,
    actor,
    resourceType: options?.resourceType,
    resourceId: options?.resourceId,
    data: data as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  };

  const eventHandlers = getHandlers(name);

  if (!eventHandlers.length) return;

  const runHandlers = async (): Promise<void> => {
    const results = await Promise.allSettled(eventHandlers.map((h) => h(event)));

    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        log.error(`App event handler failed [${name}] handler=${i}`, { error: result.reason });
      }
    }
  };

  if (db.isInTxn()) {
    db.onCommit(runHandlers);
  } else {
    await runHandlers();
  }
};
