import type { HookOptions, ManyAction, ModelName, SingleAction } from '@template/db';
import {
  DbAction,
  db,
  filterFields,
  getModelRelations,
  HookTiming,
  hasDeletedAt,
  isFalsePolymorphismRef,
  isNoOpUpdate,
  polymorphicTarget,
  registerDbHook,
  toAccessor,
  WEBHOOK_NOOP_FIELDS,
  webhookAudienceAxes,
  webhookEnabledModels,
  webhookRelatedModels,
} from '@template/db';
import type { WebhookModel, WebhookSubscription } from '@template/db/generated/client/client';
import { WebhookOwnerModel } from '@template/db/generated/client/enums';
import { auditActorContext, auditActorStore } from '@template/db/lib/auditActorContext';
import { ConcurrencyType } from '@template/shared/utils';
import { castArray, keyBy, uniq, uniqBy } from 'lodash-es';
import { isManyAction } from '#/hooks/shared/hookRows';
import { webhookGrantedAudiences, webhookRelatedRowAudiences } from '#/hooks/webhooks/audiences';
import type { WebhookParty, WebhookRow } from '#/hooks/webhooks/webhookParty';
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

type Party = WebhookParty;

const isWebhookModel = (model: string): model is WebhookModel =>
  (webhookEnabledModels as readonly string[]).includes(model);

const isOwnerModel = (kind: string): kind is WebhookOwnerModel =>
  (Object.values(WebhookOwnerModel) as string[]).includes(kind);

const axisParties = (model: WebhookModel, row: WebhookRow): Party[] =>
  webhookAudienceAxes[model].flatMap((axis) => {
    const target = polymorphicTarget(row, model, axis);
    return target && isOwnerModel(target.kind) ? [{ kind: target.kind, id: target.id }] : [];
  });

const recordAudiences = async (
  model: WebhookModel,
  rows: WebhookRow[],
): Promise<Map<string, Party[]>> => {
  const granted = (await webhookGrantedAudiences[model]?.(rows)) ?? new Map<string, Party[]>();
  return new Map(
    rows.map((row) => [
      row.id,
      uniqBy([...axisParties(model, row), ...(granted.get(row.id) ?? [])], partyKey),
    ]),
  );
};

const partyKey = (party: Party) => `${party.kind}:${party.id}`;

type Delivery = {
  model: WebhookModel;
  action: WebhookAction;
  resultData: WebhookRow;
  previousData?: Record<string, unknown>;
  parties: Party[];
};

const relatedParentModels = (model: string): WebhookModel[] =>
  (webhookRelatedModels[model] ?? [])
    .filter((ref): ref is ModelName => !isFalsePolymorphismRef(ref))
    .filter(isWebhookModel);

const parentKeyColumns = (model: string, parentModel: WebhookModel): string[] =>
  getModelRelations(model as ModelName)
    .filter((relation) => relation.targetModel === parentModel)
    .flatMap(({ foreignKey }) =>
      typeof foreignKey === 'string' ? [] : foreignKey?.id ? [foreignKey.id] : [],
    );

const relatedDeliveries = async (model: string, rows: WebhookRow[]): Promise<Delivery[]> => {
  const deliveries: Delivery[] = [];
  for (const parentModel of relatedParentModels(model)) {
    const columns = parentKeyColumns(model, parentModel);
    const parentIds = uniq(rows.flatMap((row) => columns.map((column) => row[column]))).filter(
      (id): id is string => typeof id === 'string',
    );
    if (parentIds.length === 0) continue;

    const parents = (await db.delegate(toAccessor(parentModel)).findMany({
      where: {
        id: { in: parentIds },
        ...(hasDeletedAt(parentModel) ? { deletedAt: undefined } : {}),
      },
    })) as WebhookRow[];
    if (parents.length === 0) continue;

    const audiences = await recordAudiences(parentModel, parents);
    const named = (await webhookRelatedRowAudiences[model]?.(rows)) ?? new Map<string, Party[]>();
    for (const parent of parents) {
      deliveries.push({
        model: parentModel,
        action: WebhookAction.update,
        resultData: parent,
        parties: uniqBy(
          [...(audiences.get(parent.id) ?? []), ...(named.get(parent.id) ?? [])],
          partyKey,
        ),
      });
    }
  }
  return deliveries;
};

const directDeliveries = async (model: WebhookModel, options: HookOptions): Promise<Delivery[]> => {
  const { action: dbAction } = options;
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

  const audiences = await recordAudiences(
    model,
    records.map(({ resultData }) => resultData),
  );
  return records.map(({ resultData, previousData }) => ({
    model,
    action: dbActionToWebhookAction(dbAction, previousData !== undefined),
    resultData,
    previousData,
    parties: audiences.get(resultData.id) ?? [],
  }));
};

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
  { model, action: webhookAction, resultData, previousData, parties }: Delivery,
) => {
  if (
    webhookAction === WebhookAction.update &&
    isNoOpUpdate(model, resultData, previousData, WEBHOOK_NOOP_FIELDS)
  ) {
    return [];
  }

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
      const { model } = options;
      const deliveries = isWebhookModel(model)
        ? await directDeliveries(model, options)
        : await relatedDeliveries(model, castArray(options.result ?? []) as WebhookRow[]);
      if (deliveries.length === 0) return;

      const allCallbacks: (() => Promise<void>)[] = [];
      for (const deliveryModel of uniq(deliveries.map((delivery) => delivery.model))) {
        const forModel = deliveries.filter((delivery) => delivery.model === deliveryModel);
        const parties = forModel.flatMap((delivery) => delivery.parties);
        if (parties.length === 0) continue;
        const subscriptions = await findPartySubscriptions(deliveryModel, parties);
        if (subscriptions.length === 0) continue;
        for (const delivery of forModel) {
          allCallbacks.push(...processSingleRecord(subscriptions, delivery));
        }
      }
      if (allCallbacks.length === 0) return;

      db.onCommit(allCallbacks, ConcurrencyType.queue);
    },
    [auditActorStore],
  );
};
