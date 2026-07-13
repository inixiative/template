import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import {
  DbAction,
  db,
  filterIgnoredFields,
  HookTiming,
  isFalsePolymorphismRef,
  registerDbHook,
  webhookEnabledModels,
  webhookRelatedModels,
} from '@template/db';
import type { WebhookModel, WebhookSubscription } from '@template/db/generated/client/client';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { ConcurrencyType } from '@template/shared/utils';
import { castArray, compact } from 'lodash-es';
import { isNoOpUpdate } from '#/hooks/isNoOpUpdate';
import { buildPreviousById, isManyAction } from '#/hooks/shared/hookRows';
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

const getWebhookCallbacks = (subscriptions: WebhookSubscription[], payload: WebhookPayload) => {
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

const dbActionToWebhookAction = (dbAction: DbAction, hasPrevious: boolean): WebhookAction => {
  if (dbAction === DbAction.upsert) {
    return hasPrevious ? WebhookAction.update : WebhookAction.create;
  }
  if (dbAction === DbAction.createManyAndReturn) return WebhookAction.create;
  if (dbAction === DbAction.updateManyAndReturn) return WebhookAction.update;
  if (dbAction === DbAction.deleteMany) return WebhookAction.delete;
  return dbAction as unknown as WebhookAction;
};

const processSingleRecord = (
  subscriptions: WebhookSubscription[],
  webhookModel: string,
  model: string,
  webhookAction: WebhookAction,
  resultData: Record<string, unknown> & { id: string },
  previousData?: Record<string, unknown>,
) => {
  if (webhookAction === WebhookAction.update && isNoOpUpdate(model, resultData, previousData)) {
    return [];
  }

  const origin = auditActorContext.getScope()?.integrationId ?? null;
  const targets = origin ? subscriptions.filter((sub) => sub.integrationId !== origin) : subscriptions;
  if (targets.length === 0) return [];

  const payload: WebhookPayload = {
    model: webhookModel,
    action: webhookAction,
    resourceId: resultData.id,
    data: filterIgnoredFields(model, resultData),
    previousData: previousData ? filterIgnoredFields(model, previousData) : undefined,
    timestamp: new Date().toISOString(),
  };

  return getWebhookCallbacks(targets, payload);
};

export const registerWebhookHook = () => {
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

    const relatedRefs = webhookRelatedModels[model];
    const webhookTargets: string[] = relatedRefs?.length
      ? relatedRefs.map((ref) => (isFalsePolymorphismRef(ref) ? ref.model : ref))
      : [model];

    const enabledTargets = webhookTargets.filter((m) => (webhookEnabledModels as readonly string[]).includes(m));
    if (enabledTargets.length === 0) return;

    let allCallbacks: (() => Promise<void>)[] = [];

    // Prefetch all subscriptions for enabled models in one query, then group.
    const allSubscriptions = await db.webhookSubscription.findMany({
      where: { model: { in: enabledTargets as WebhookModel[] }, isActive: true },
    });
    const subscriptionsByModel = new Map<string, WebhookSubscription[]>();
    for (const target of enabledTargets) subscriptionsByModel.set(target, []);
    for (const sub of allSubscriptions) {
      const bucket = subscriptionsByModel.get(sub.model);
      if (bucket) bucket.push(sub);
    }

    // Process for each enabled target model
    for (const webhookModel of enabledTargets) {
      const subscriptions = subscriptionsByModel.get(webhookModel) ?? [];
      if (subscriptions.length === 0) continue;

      if (isManyAction(dbAction)) {
        const { result, previous } = options as HookOptions & { action: ManyAction };
        const results = compact(castArray(result)) as (Record<string, unknown> & { id: string })[];
        const previousById = buildPreviousById(previous);

        for (const resultData of results) {
          const webhookAction = dbActionToWebhookAction(dbAction, previousById.has(resultData.id));
          const previousData = previousById.get(resultData.id);
          const callbacks = processSingleRecord(
            subscriptions,
            webhookModel,
            model,
            webhookAction,
            resultData,
            previousData,
          );
          allCallbacks = allCallbacks.concat(callbacks);
        }
      } else {
        const { result, previous } = options as HookOptions & { action: SingleAction };
        const resultData = result as Record<string, unknown> & { id: string };
        const previousData = previous as Record<string, unknown> | undefined;
        const webhookAction = dbActionToWebhookAction(dbAction, !!previousData);
        const callbacks = processSingleRecord(
          subscriptions,
          webhookModel,
          model,
          webhookAction,
          resultData,
          previousData,
        );
        allCallbacks = allCallbacks.concat(callbacks);
      }
    }

    if (allCallbacks.length === 0) return;

    db.onCommit(allCallbacks, ConcurrencyType.queue);
  });
};
