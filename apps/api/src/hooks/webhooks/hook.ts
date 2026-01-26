import { DbAction, HookTiming, db, registerDbHook } from '@template/db';
import { getParentWebhookModel, isNoOpUpdate, isWebhookEnabled, selectRelevantFields } from '#/hooks/webhooks/utils';

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

export type WebhookDeliveryFn = (payload: WebhookPayload) => Promise<void>;

export function registerWebhookHook(deliverWebhookFn: WebhookDeliveryFn) {
  const actions = [DbAction.create, DbAction.update, DbAction.delete, DbAction.upsert];

  registerDbHook(
    'webhookDelivery',
    '*',
    HookTiming.after,
    actions,
    async ({ model, action: dbAction, result, before }) => {
      const parentModel = getParentWebhookModel(model);
      const webhookModel = parentModel ?? model;

      if (!isWebhookEnabled(webhookModel)) return;

      let webhookAction: WebhookAction;
      if (dbAction === DbAction.upsert) {
        webhookAction = WebhookAction.update;
      } else {
        webhookAction = dbAction as unknown as WebhookAction;
      }

      const resultData = result as Record<string, unknown> & { id: string };
      const previousData = before as Record<string, unknown> | undefined;

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

      if (db.isInTxn()) {
        db.onCommit(() => deliverWebhookFn(payload));
      } else {
        await deliverWebhookFn(payload);
      }
    },
  );
}
