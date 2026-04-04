import { db } from '@template/db';
import { log } from '@template/shared/logger';
import type { AppEventPayloads } from '#/appEvents/handlers';
import { appEventHandlers } from '#/appEvents/handlers';
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

  const handler = appEventHandlers[name];
  if (!handler) return;

  const runHandler = () => handler(event);

  if (db.isInTxn()) {
    db.onCommit(runHandler);
  } else {
    try {
      await runHandler();
    } catch (err) {
      log.error(`App event handler failed [${name}]`, { error: err });
    }
  }
};
