import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import {
  DbAction,
  db,
  filterFields,
  HookTiming,
  isNoOpUpdate,
  polymorphicTarget,
  registerDbHook,
  WEBHOOK_NOOP_FIELDS,
  webhookAudienceAxes,
  webhookEnabledModels,
} from '@template/db';
import type { WebhookModel, WebhookSubscription } from '@template/db/generated/client/client';
import { WebhookOwnerModel } from '@template/db/generated/client/enums';
import { auditActorContext, auditActorStore } from '@template/db/lib/auditActorContext';
import { ConcurrencyType } from '@template/shared/utils';
import { keyBy, uniq } from 'lodash-es';
import { isManyAction } from '#/hooks/shared/hookRows';
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

type WebhookRow = Record<string, unknown> & { id: string };
type Party = { kind: WebhookOwnerModel; id: string };

const isWebhookModel = (model: string): model is WebhookModel =>
  (webhookEnabledModels as readonly string[]).includes(model);

const isOwnerModel = (kind: string): kind is WebhookOwnerModel =>
  (Object.values(WebhookOwnerModel) as string[]).includes(kind);

const recordParties = (model: WebhookModel, row: WebhookRow): Party[] =>
  webhookAudienceAxes[model].flatMap((axis) => {
    const target = polymorphicTarget(row, model, axis);
    return target && isOwnerModel(target.kind) ? [{ kind: target.kind, id: target.id }] : [];
  });

const isPartyTo = (subscription: WebhookSubscription, parties: Party[]) => {
  const owner = polymorphicTarget(subscription, 'WebhookSubscription', 'ownerModel');
  return !!owner && parties.some((party) => party.kind === owner.kind && party.id === owner.id);
};

const partyIds = (parties: Party[], kind: WebhookOwnerModel) =>
  uniq(parties.filter((party) => party.kind === kind).map((party) => party.id));

const findPartySubscriptions = (model: WebhookModel, parties: Party[]) =>
  db.webhookSubscription.findMany({
    where: {
      model,
      isActive: true,
      OR: [
        {
          ownerModel: WebhookOwnerModel.User,
          userId: { in: partyIds(parties, WebhookOwnerModel.User) },
        },
        {
          ownerModel: WebhookOwnerModel.Organization,
          organizationId: { in: partyIds(parties, WebhookOwnerModel.Organization) },
        },
        {
          ownerModel: WebhookOwnerModel.Space,
          spaceId: { in: partyIds(parties, WebhookOwnerModel.Space) },
        },
      ],
    },
  });

const processSingleRecord = (
  subscriptions: WebhookSubscription[],
  model: WebhookModel,
  webhookAction: WebhookAction,
  resultData: WebhookRow,
  previousData?: Record<string, unknown>,
) => {
  if (
    webhookAction === WebhookAction.update &&
    isNoOpUpdate(model, resultData, previousData, WEBHOOK_NOOP_FIELDS)
  ) {
    return [];
  }

  const parties = recordParties(model, resultData);
  const origin = auditActorContext.getScope()?.integrationId ?? null;
  const targets = subscriptions.filter(
    (sub) => isPartyTo(sub, parties) && (!origin || sub.integrationId !== origin),
  );
  if (targets.length === 0) return [];

  const payload: WebhookPayload = {
    model,
    action: webhookAction,
    resourceId: resultData.id,
    data: filterFields(model, resultData, WEBHOOK_NOOP_FIELDS),
    previousData: previousData ? filterFields(model, previousData, WEBHOOK_NOOP_FIELDS) : undefined,
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

  registerDbHook(
    'webhookDelivery',
    '*',
    HookTiming.after,
    actions,
    async (options: HookOptions) => {
      const { model, action: dbAction } = options;
      if (!isWebhookModel(model)) return;

      const records: { resultData: WebhookRow; previousData?: Record<string, unknown> }[] = [];
      if (isManyAction(dbAction)) {
        const { result, previous } = options as HookOptions & { action: ManyAction };
        const previousById = keyBy(previous, 'id');
        for (const resultData of (result ?? []) as WebhookRow[]) {
          records.push({ resultData, previousData: previousById[resultData.id] });
        }
      } else {
        const { result, previous } = options as HookOptions & { action: SingleAction };
        records.push({
          resultData: result as WebhookRow,
          previousData: previous as Record<string, unknown> | undefined,
        });
      }

      const parties = records.flatMap(({ resultData }) => recordParties(model, resultData));
      if (parties.length === 0) return;

      const subscriptions = await findPartySubscriptions(model, parties);
      if (subscriptions.length === 0) return;

      const allCallbacks = records.flatMap(({ resultData, previousData }) =>
        processSingleRecord(
          subscriptions,
          model,
          dbActionToWebhookAction(dbAction, previousData !== undefined),
          resultData,
          previousData,
        ),
      );
      if (allCallbacks.length === 0) return;

      db.onCommit(allCallbacks, ConcurrencyType.queue);
    },
    [auditActorStore],
  );
};
