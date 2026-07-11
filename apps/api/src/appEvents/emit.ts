/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:appEvents
 * @uses infrastructure:prisma, infrastructure:observability
 */
import { db } from '@template/db';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import { log } from '@template/shared/logger';
import type { AppEventPayloads } from '#/appEvents/handlers';
import { appEventHandlers } from '#/appEvents/handlers';
import type { AppEventPayload } from '#/appEvents/types';
import { observeRegistry } from '#/lib/observe';

export const emitAppEvent = async <K extends keyof AppEventPayloads>(
  name: K,
  data: AppEventPayloads[K] & Record<string, unknown>,
): Promise<void> => {
  const actor = auditActorContext.getScope() ?? nullAuditActor;

  const event: AppEventPayload = {
    name,
    actor,
    data: data as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  };

  const run = async () => {
    try {
      await observeRegistry.broadcast((adapter) => adapter.record(event));
    } catch (err) {
      log.error(`appEvent observe failed: ${name}`, err);
    }

    const handler = appEventHandlers[name];
    if (handler) await handler(event);
  };

  if (db.isInTxn()) {
    db.onCommit(run);
  } else {
    await run();
  }
};
