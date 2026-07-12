/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:appEvents
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import type { AppEventPayloads } from '#/appEvents/handlers';
import { appEventHandlers } from '#/appEvents/handlers';
import type { AppEventPayload } from '#/appEvents/types';

export const emitAppEvent = async <K extends keyof AppEventPayloads>(
  name: K,
  data: AppEventPayloads[K] & Record<string, unknown>,
): Promise<void> => {
  const actor = auditActorContext.getScope() ?? nullAuditActor;

  const event: AppEventPayload = {
    id: Bun.randomUUIDv7(),
    name,
    actor,
    data: data as Record<string, unknown>,
  };

  const handler = appEventHandlers[name];
  if (!handler) return;

  if (db.isInTxn()) {
    db.onCommit(() => handler(event));
  } else {
    await handler(event);
  }
};
