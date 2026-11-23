/**
 * @atlas
 * @kind utils
 * @partOf feature:webhooks
 */
import {
  type BindableOwnerModel,
  db,
  type FalsePolymorphismRef,
  isBindableOwnerModel,
  isFalsePolymorphismRef,
  type ModelName,
  polymorphicKeyColumn,
  polymorphismConfigForModel,
  relationsOfModel,
  rowPolymorphicAxisPointsAt,
  toAccessor,
  webhookEnabledModels,
  webhookRelatedModels,
  wherePolymorphicSideIsOneOf,
} from '@template/db';
import type { WebhookModel } from '@template/db/generated/client/client';
import type { ModelRow } from '@template/shared/utils/modelRow';
import { groupBy, keyBy, mergeWith, uniq, uniqBy } from 'lodash-es';
import { webhookGrantedAudiences, webhookRelatedRowAudiences } from '#/hooks/webhooks/audiences';

export type WebhookRow = Record<string, unknown> & { id: string };
export type Party = ModelRow<BindableOwnerModel>;

const axisParty = (model: WebhookModel, row: Record<string, unknown>, axis: string): Party[] => {
  const target = rowPolymorphicAxisPointsAt(row, model, axis);
  return target && isBindableOwnerModel(target.model)
    ? [{ model: target.model, id: target.id }]
    : [];
};

const partyAxes = (model: WebhookModel) =>
  (polymorphismConfigForModel(model)?.axes ?? []).map(({ field }) => field);

export const webhookPartiesOfRow = (model: WebhookModel, row: Record<string, unknown>): Party[] =>
  partyAxes(model).flatMap((axis) => axisParty(model, row, axis));

const counterparties = (
  model: WebhookModel,
  row: Record<string, unknown>,
  ownAxis: string,
): Party[] =>
  partyAxes(model)
    .filter((axis) => axis !== ownAxis)
    .flatMap((axis) => axisParty(model, row, axis));

const diedWith = (relation: Record<string, unknown>, row: WebhookRow) =>
  relation.deletedAt == null ||
  (row.deletedAt instanceof Date &&
    relation.deletedAt instanceof Date &&
    relation.deletedAt.getTime() === row.deletedAt.getTime());

export const fetchWebhookPartiesThroughRelation = async (
  ref: FalsePolymorphismRef,
  rows: WebhookRow[],
): Promise<Record<string, Party[]>> => {
  const column = polymorphicKeyColumn(ref.model, ref.axis, ref.value);
  if (!column) return {};
  const tombstones = rows.flatMap(({ deletedAt }) =>
    deletedAt instanceof Date ? [deletedAt] : [],
  );
  const relations = await db.delegate(ref.model).findMany({
    where: {
      AND: [
        wherePolymorphicSideIsOneOf(
          ref.model,
          ref.axis,
          rows.map((row) => ({ model: ref.value, id: row.id })),
        ),
        { OR: [{ deletedAt: null }, { deletedAt: { in: tombstones } }] },
      ],
    },
  });
  const rowsById = keyBy(rows, 'id');
  return Object.fromEntries(
    Object.entries(groupBy(relations, (relation) => relation[column])).map(
      ([rowId, rowRelations]) => [
        rowId,
        rowRelations
          .filter((relation) => diedWith(relation, rowsById[rowId]))
          .flatMap((relation) => counterparties(ref.model as WebhookModel, relation, ref.axis)),
      ],
    ),
  );
};

export const isWebhookModel = (model: string): model is WebhookModel =>
  (webhookEnabledModels as readonly string[]).includes(model);

export const partyKey = (party: Party) => `${party.model}:${party.id}`;

const ownAudiences = async (
  model: WebhookModel,
  rows: WebhookRow[],
): Promise<Record<string, Party[]>> => {
  const granted = webhookGrantedAudiences[model];
  if (!granted) {
    return Object.fromEntries(rows.map((row) => [row.id, webhookPartiesOfRow(model, row)]));
  }
  const audiences = await granted(rows);
  return Object.fromEntries(rows.map((row) => [row.id, audiences.get(row.id) ?? []]));
};

export type ParentDelivery = {
  webhookModel: WebhookModel;
  parents: WebhookRow[];
  partiesByRowId: Record<string, Party[]>;
};

const parentKeyColumns = (model: string, parentModel: WebhookModel): string[] =>
  relationsOfModel(model as ModelName)
    .filter((relation) => relation.targetModel === parentModel)
    .flatMap(({ foreignKey }) => {
      if (!foreignKey) return [];
      if (typeof foreignKey === 'string') return [foreignKey];
      return foreignKey.id ? [foreignKey.id] : [];
    });

export const fetchParentDeliveries = async (
  model: string,
  rows: WebhookRow[],
): Promise<ParentDelivery[]> => {
  const parentModels = (webhookRelatedModels[model] ?? [])
    .filter((ref): ref is ModelName => !isFalsePolymorphismRef(ref))
    .filter(isWebhookModel);
  const deliveries: ParentDelivery[] = [];
  for (const parentModel of parentModels) {
    const columns = parentKeyColumns(model, parentModel);
    const parentIds = uniq(rows.flatMap((row) => columns.map((column) => row[column]))).filter(
      (id): id is string => typeof id === 'string',
    );
    if (parentIds.length === 0) continue;
    const parents = (await db.delegate(toAccessor(parentModel)).findMany({
      where: { id: { in: parentIds } },
    })) as WebhookRow[];
    if (parents.length === 0) continue;
    const audiences = await ownAudiences(parentModel, parents);
    const named = (await webhookRelatedRowAudiences[model]?.(rows)) ?? new Map<string, Party[]>();
    deliveries.push({
      webhookModel: parentModel,
      parents,
      partiesByRowId: Object.fromEntries(
        parents.map((parent) => [
          parent.id,
          uniqBy([...(audiences[parent.id] ?? []), ...(named.get(parent.id) ?? [])], partyKey),
        ]),
      ),
    });
  }
  return deliveries;
};

export const fetchWebhookPartiesByRow = async (
  model: string,
  rows: WebhookRow[],
): Promise<[WebhookModel, Record<string, Party[]>][]> => {
  if (isWebhookModel(model)) return [[model, await ownAudiences(model, rows)]];
  const refs = (webhookRelatedModels[model] ?? []).filter(
    (ref): ref is FalsePolymorphismRef => isFalsePolymorphismRef(ref) && isWebhookModel(ref.model),
  );
  if (refs.length === 0 || rows.length === 0) return [];
  return Promise.all(
    Object.entries(groupBy(refs, 'model')).map(async ([webhookModel, modelRefs]) => {
      const partyMaps = await Promise.all(
        modelRefs.map((ref) => fetchWebhookPartiesThroughRelation(ref, rows)),
      );
      const merged = mergeWith({}, ...partyMaps, (current: Party[] | undefined, next: Party[]) =>
        current ? current.concat(next) : next,
      );
      return [webhookModel as WebhookModel, merged] as [WebhookModel, Record<string, Party[]>];
    }),
  );
};
