import type { HookOptions, ManyAction, SingleAction, WebhookModel } from '@template/db';
import { DbAction, HookTiming, db, registerDbHook } from '@template/db';
import { ConcurrencyType } from '@template/shared/utils';
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

const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn ||
  action === DbAction.updateManyAndReturn ||
  action === DbAction.deleteMany;

const dbActionToWebhookAction = (dbAction: DbAction, hasPrevious: boolean): WebhookAction => {
  if (dbAction === DbAction.upsert) {
    return hasPrevious ? WebhookAction.update : WebhookAction.create;
  }
  if (dbAction === DbAction.createManyAndReturn) return WebhookAction.create;
  if (dbAction === DbAction.updateManyAndReturn) return WebhookAction.update;
  if (dbAction === DbAction.deleteMany) return WebhookAction.delete;
  return dbAction as unknown as WebhookAction;
};

const processSingleRecord = async (
  webhookModel: string,
  model: string,
  webhookAction: WebhookAction,
  resultData: Record<string, unknown> & { id: string },
  previousData?: Record<string, unknown>,
) => {
  if (webhookAction === WebhookAction.update && isNoOpUpdate(model, resultData, previousData)) {
    return [];
  }

  const payload: WebhookPayload = {
    model: webhookModel,
    action: webhookAction,
    resourceId: resultData.id,
    data: selectRelevantFields(model, resultData),
    previousData: previousData ? selectRelevantFields(model, previousData) : undefined,
    timestamp: new Date().toISOString(),
  };

  return getWebhookCallbacks(payload);
};

export function registerWebhookHook() {
  const actions = [
    DbAction.create,
    DbAction.update,
    DbAction.delete,
    DbAction.upsert,
    DbAction.createManyAndReturn,
    DbAction.updateManyAndReturn,
    DbAction.deleteMany,
  ];

  registerDbHook('webhookDelivery', '*', HookTiming.after, actions, async (options: HookOptions) => {
    const { model, action: dbAction } = options;
    const parentModel = getParentWebhookModel(model);
    const webhookModel = parentModel ?? model;

    if (!isWebhookEnabled(webhookModel)) return;

    let allCallbacks: (() => Promise<void>)[] = [];

    if (isManyAction(dbAction)) {
      const { result, previous } = options as HookOptions & { action: ManyAction };
      const results = (result ?? []) as (Record<string, unknown> & { id: string })[];
      const previouses = (previous ?? []) as Record<string, unknown>[];

      // Build a map of previous records by id for efficient lookup
      const previousById = new Map<string, Record<string, unknown>>();
      for (const prev of previouses) {
        if (prev.id) previousById.set(prev.id as string, prev);
      }

      for (const resultData of results) {
        const webhookAction = dbActionToWebhookAction(dbAction, previousById.has(resultData.id));
        const previousData = previousById.get(resultData.id);
        const callbacks = await processSingleRecord(webhookModel, model, webhookAction, resultData, previousData);
        allCallbacks = allCallbacks.concat(callbacks);
      }
    } else {
      const { result, previous } = options as HookOptions & { action: SingleAction };
      const resultData = result as Record<string, unknown> & { id: string };
      const previousData = previous as Record<string, unknown> | undefined;
      const webhookAction = dbActionToWebhookAction(dbAction, !!previousData);
      allCallbacks = await processSingleRecord(webhookModel, model, webhookAction, resultData, previousData);
    }

    if (allCallbacks.length === 0) return;

    db.onCommit(allCallbacks, ConcurrencyType.queue);
  });
}
