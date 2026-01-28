import type { WebhookModel } from '@template/db';
import { DbAction, HookTiming, db, registerDbHook } from '@template/db';
import { getParentWebhookModel, isNoOpUpdate, isWebhookEnabled, selectRelevantFields } from '#/hooks/webhooks/utils';
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

const getWebhookCallbacks = async (payload: WebhookPayload) => {
  const subscriptions = await db.webhookSubscription.findMany({
    where: { model: payload.model as WebhookModel, isActive: true },
    select: { id: true },
  });

  return subscriptions.map((sub) => async () => {
    await enqueueJob('sendWebhook', {
      subscriptionId: sub.id,
      action: payload.action,
      resourceId: payload.resourceId,
      data: payload.data,
    });
  });
};

export function registerWebhookHook() {
  const actions = [DbAction.create, DbAction.update, DbAction.delete, DbAction.upsert];

  registerDbHook(
    'webhookDelivery',
    '*',
    HookTiming.after,
    actions,
    async ({ model, action: dbAction, result, previous }) => {
      const parentModel = getParentWebhookModel(model);
      const webhookModel = parentModel ?? model;

      if (!isWebhookEnabled(webhookModel)) return;

      let webhookAction: WebhookAction;
      if (dbAction === DbAction.upsert) {
        // Upsert is create if no previous record existed, update otherwise
        webhookAction = previous ? WebhookAction.update : WebhookAction.create;
      } else {
        webhookAction = dbAction as unknown as WebhookAction;
      }

      const resultData = result as Record<string, unknown> & { id: string };
      const previousData = previous as Record<string, unknown> | undefined;

      if (webhookAction === WebhookAction.update && isNoOpUpdate(model, resultData, previousData)) {
        return;
      }

      const payload: WebhookPayload = {
        model: webhookModel,
        action: webhookAction,
        resourceId: resultData.id,
        data: selectRelevantFields(model, resultData),
        previousData: previousData ? selectRelevantFields(model, previousData) : undefined,
        timestamp: new Date().toISOString(),
      };

      const callbacks = await getWebhookCallbacks(payload);
      if (callbacks.length === 0) return;

      if (db.isInTxn()) {
        db.onCommit(callbacks);
      } else {
        await Promise.all(callbacks.map((fn) => fn()));
      }
    },
  );
}
