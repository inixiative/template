/**
 * @atlas
 * @kind helper
 * @partOf feature:webhooks
 */
import {
  db,
  type FalsePolymorphismRef,
  getPolymorphismConfig,
  isOwnerKind,
  type PolymorphicKind,
  polymorphicKeyColumn,
  polymorphicTarget,
  webhookEnabledModels,
  webhookRelatedModels,
} from '@template/db';
import type { WebhookModel } from '@template/db/generated/client/client';
import { groupBy, keyBy, mergeWith } from 'lodash-es';

export type WebhookRow = Record<string, unknown> & { id: string };
export type Party = { kind: PolymorphicKind; id: string };

const axisParty = (model: WebhookModel, row: Record<string, unknown>, axis: string): Party[] => {
  const target = polymorphicTarget(row, model, axis);
  return target && isOwnerKind(target.kind) ? [{ kind: target.kind, id: target.id }] : [];
};

const partyAxes = (model: WebhookModel) =>
  (getPolymorphismConfig(model)?.axes ?? []).map(({ field }) => field);

export const recordParties = (model: WebhookModel, row: Record<string, unknown>): Party[] =>
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

export const relatedCounterparties = async (
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
      [ref.axis]: ref.value,
      [column]: { in: rows.map((row) => row.id) },
      OR: [{ deletedAt: null }, { deletedAt: { in: tombstones } }],
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

export const recordAudiences = async (
  model: string,
  rows: WebhookRow[],
): Promise<[WebhookModel, Record<string, Party[]>][]> => {
  if (isWebhookModel(model)) {
    return [[model, Object.fromEntries(rows.map((row) => [row.id, recordParties(model, row)]))]];
  }
  const refs = (webhookRelatedModels[model] ?? []).filter((ref) => isWebhookModel(ref.model));
  if (refs.length === 0 || rows.length === 0) return [];
  return Promise.all(
    Object.entries(groupBy(refs, 'model')).map(async ([webhookModel, modelRefs]) => {
      const partyMaps = await Promise.all(modelRefs.map((ref) => relatedCounterparties(ref, rows)));
      const merged = mergeWith({}, ...partyMaps, (current: Party[] | undefined, next: Party[]) =>
        current ? current.concat(next) : next,
      );
      return [webhookModel as WebhookModel, merged] as [WebhookModel, Record<string, Party[]>];
    }),
  );
};
