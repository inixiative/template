import type { HookOptions } from '@template/db';
import {
  DbAction,
  db,
  HookTiming,
  isNoOpUpdate,
  omitRegisteredFields,
  registerDbHook,
  WEBHOOK_EXCLUDED_FIELDS,
} from '@template/db';
import type { WebhookSubscription } from '@template/db/generated/client/client';
import { auditActorContext, auditActorStore } from '@template/db/lib/auditActorContext';
import { ConcurrencyType } from '@template/shared/utils';
import { ALL_MUTATION_ACTIONS, changedPairs } from '#/hooks/shared/hookRows';
import { isSoftDeleteTransition } from '#/hooks/shared/softDeleteTransition';
import { fetchWebhookPartiesByRow, type WebhookRow } from '#/hooks/webhooks/parties';
import { findPartySubscriptions, isPartyTo } from '#/hooks/webhooks/subscriptions';
import { enqueueJob } from '#/jobs/enqueue';

export enum WebhookAction {
  create = 'create',
  update = 'update',
  delete = 'delete',
}

export type WebhookPayload = {
  model: string;
  action: WebhookAction;
  resourceId: string;
  data: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  timestamp: string;
};

const webhookEnqueueCallbacks = (subscriptions: WebhookSubscription[], payload: WebhookPayload) => {
  return subscriptions.map((sub: WebhookSubscription) => async () => {
    await enqueueJob('sendWebhook', {
      subscriptionId: sub.id,
      action: payload.action,
      resourceId: payload.resourceId,
      data: payload.data,
      timestamp: payload.timestamp,
    });
  });
};

const dbActionToWebhookAction = (
  dbAction: DbAction,
  record: Record<string, unknown>,
  previous?: Record<string, unknown>,
): WebhookAction => {
  if (dbAction === DbAction.createManyAndReturn || dbAction === DbAction.create) {
    return WebhookAction.create;
  }
  if (dbAction === DbAction.delete || dbAction === DbAction.deleteMany) return WebhookAction.delete;
  if (dbAction === DbAction.upsert && !previous) return WebhookAction.create;
  return isSoftDeleteTransition(previous, record) ? WebhookAction.delete : WebhookAction.update;
};

const processSingleRecord = (
  subscriptions: WebhookSubscription[],
  webhookModel: string,
  model: string,
  webhookAction: WebhookAction,
  resultData: WebhookRow,
  previousData?: Record<string, unknown>,
) => {
  if (
    webhookAction === WebhookAction.update &&
    isNoOpUpdate(model, resultData, previousData, WEBHOOK_EXCLUDED_FIELDS)
  ) {
    return [];
  }

  const origin = auditActorContext.currentActor()?.integrationId ?? null;
  const targets = origin
    ? subscriptions.filter((sub) => sub.integrationId !== origin)
    : subscriptions;
  if (targets.length === 0) return [];

  const payload: WebhookPayload = {
    model: webhookModel,
    action: webhookAction,
    resourceId: resultData.id,
    data: omitRegisteredFields(model, resultData, WEBHOOK_EXCLUDED_FIELDS),
    previousData: previousData
      ? omitRegisteredFields(model, previousData, WEBHOOK_EXCLUDED_FIELDS)
      : undefined,
    timestamp: new Date().toISOString(),
  };

  return webhookEnqueueCallbacks(targets, payload);
};

export const registerWebhookHook = () => {
  registerDbHook(
    'webhookDelivery',
    '*',
    HookTiming.after,
    ALL_MUTATION_ACTIONS,
    async (options: HookOptions) => {
      const { model, action: dbAction } = options;

      const records = changedPairs(options).flatMap(({ result, previous }) =>
        result ? [{ resultData: result as WebhookRow, previousData: previous }] : [],
      );
      if (records.length === 0) return;

      const audiences = await fetchWebhookPartiesByRow(
        model,
        records.map(({ resultData }) => resultData),
      );

      let allCallbacks: (() => Promise<void>)[] = [];

      for (const [webhookModel, partiesByRowId] of audiences) {
        const subscriptions = await findPartySubscriptions(
          webhookModel,
          Object.values(partiesByRowId).flat(),
        );
        if (subscriptions.length === 0) continue;

        for (const { resultData, previousData } of records) {
          const parties = partiesByRowId[resultData.id] ?? [];
          const callbacks = processSingleRecord(
            subscriptions.filter((sub) => isPartyTo(sub, parties)),
            webhookModel,
            model,
            dbActionToWebhookAction(dbAction, resultData, previousData),
            resultData,
            previousData,
          );
          allCallbacks = allCallbacks.concat(callbacks);
        }
      }

      if (allCallbacks.length === 0) return;

      db.onCommit(allCallbacks, ConcurrencyType.queue);
    },
    [auditActorStore],
  );
};
