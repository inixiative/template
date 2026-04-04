import { db } from '@template/db';
import type { AppEventPayloads } from '#/appEvents/handlers';
import { appEventHandlers } from '#/appEvents/handlers';
import type { AppEventOptions, AppEventPayload } from '#/appEvents/types';
import { auditActorContext, nullAuditActor } from '#/lib/auditActorContext';

export const emitAppEvent = async <K extends keyof AppEventPayloads>(
  name: K,
  data: AppEventPayloads[K] & Record<string, unknown>,
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

  const handler = appEventHandlers[name];
  if (!handler) return;

  if (db.isInTxn()) {
    db.onCommit(() => handler(event));
  } else {
    await handler(event);
  }
};
