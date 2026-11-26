/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import {
  db,
  MEMBER_MODELS,
  type ModelName,
  relationsOfModel,
  SOFT_DELETE_MODEL_SET,
  userKeyColumns,
} from '@template/db';
import type { UserMerge } from '@template/db/lib/auditActorContext';
import { polymorphicAxis, sideKeyColumns } from '@template/db/registries/falsePolymorphism';
import { modelNames } from '@template/db/utils/modelNames';
import { groupBy, partition, uniqBy } from 'lodash-es';
import { fetchRepointData } from '#/modules/inquiry/services/mergeUser/fetchRepointData';
import { fetchRowAlreadyHoldingTheUniqueKey } from '#/modules/inquiry/services/mergeUser/fetchRowAlreadyHoldingTheUniqueKey';
import type { Repoint, Row } from '#/modules/inquiry/services/mergeUser/repoint';

const SIGN_IN_MODELS: readonly ModelName[] = ['Session', 'Passkey', 'TwoFactor'];

const mergeOrder: readonly ModelName[] = [
  ...MEMBER_MODELS,
  ...modelNames.filter(
    (model) =>
      model !== 'User' &&
      !(MEMBER_MODELS as readonly ModelName[]).includes(model) &&
      !SIGN_IN_MODELS.includes(model),
  ),
];

const repointedUserColumnsOf = (model: ModelName) =>
  model === 'AuditLog' ? ['subjectUserId'] : userKeyColumns(model);

const repointedRowsWhere = (model: ModelName) => {
  if (model === 'AuditLog') return { subjectModel: { not: 'User' } };
  if (model === 'Account') return { providerId: { not: 'credential' } };
  return {};
};

const ANCHOR_COLUMNS = new Set([
  'ArtifactPermission.artifactId',
  ...sideKeyColumns(polymorphicAxis('Entitlement', 'sourceModel')).map(
    (column) => `Entitlement.${column}`,
  ),
]);

const childColumnsOf = (parent: ModelName) =>
  uniqBy(
    modelNames
      .filter((model) => model !== 'AuditLog')
      .flatMap((model) =>
        relationsOfModel(model).flatMap(({ targetModel, foreignKey }) => {
          if (targetModel !== parent || !foreignKey) return [];
          const column = typeof foreignKey === 'string' ? foreignKey : foreignKey.id;
          return column && !ANCHOR_COLUMNS.has(`${model}.${column}`) ? [{ model, column }] : [];
        }),
      ),
    ({ model, column }) => `${model}.${column}`,
  );

const userRepoints = ({ sourceUserId, targetUserId }: UserMerge): Repoint[] =>
  mergeOrder.flatMap((model) =>
    repointedUserColumnsOf(model).map((column) => ({
      model,
      column,
      from: sourceUserId,
      to: targetUserId,
    })),
  );

type Loser = { model: ModelName; row: Row };

const heldTombstoneGivesWay = (model: ModelName, held: Row, row: Row) =>
  SOFT_DELETE_MODEL_SET.has(model) && held.deletedAt != null && row.deletedAt == null;

const planWrites = (merge: UserMerge, model: ModelName, data: Record<string, unknown>) => {
  for (const [column, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue;
    const key = `${model}.${column}`;
    merge.plannedWrites.set(key, (merge.plannedWrites.get(key) ?? new Set()).add(value));
  }
};

const repointRow = async (
  repoint: Repoint,
  row: Row,
  merge: UserMerge,
  losers: Loser[],
): Promise<Repoint[]> => {
  const { model } = repoint;
  const data = await fetchRepointData(repoint, row);
  const held = await fetchRowAlreadyHoldingTheUniqueKey(model, row, data);
  if (held && !heldTombstoneGivesWay(model, held, row)) {
    losers.push({ model, row });
    return childColumnsOf(model).map((child) => ({ ...child, from: row.id, to: held.id }));
  }
  if (held) {
    merge.plannedDeletes.add(`${model}.${held.id}`);
    await db.withDeleted(() => db.delegate(model).delete({ where: { id: held.id } }));
  }
  planWrites(merge, model, data);
  await db.withDeleted(() => db.delegate(model).update({ where: { id: row.id }, data }));
  return [];
};

const removeLosers = async (losers: Loser[]) => {
  for (const [model, rows] of Object.entries(groupBy(losers, 'model')) as [ModelName, Loser[]][]) {
    const ids = rows.map(({ row }) => row.id);
    if (!SOFT_DELETE_MODEL_SET.has(model)) {
      await db.delegate(model).deleteMany({ where: { id: { in: ids } } });
      continue;
    }
    const [live] = partition(rows, ({ row }) => row.deletedAt == null);
    if (live.length === 0) continue;
    await db.delegate(model).updateManyAndReturn({
      where: { id: { in: live.map(({ row }) => row.id) }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
};

/** Moves every row the source user holds to the target. Where the target already holds the same unique key, the target's row wins: the source's row's children move to it and the source's row is removed. A tombstone the target holds gives way to a live source row. */
export const mergeUserRows = async (merge: UserMerge): Promise<void> => {
  const queue = userRepoints(merge);
  const losers: Loser[] = [];
  for (let repoint = queue.shift(); repoint; repoint = queue.shift()) {
    const { model, column, from } = repoint;
    const rows = (await db.withDeleted(() =>
      db.delegate(model).findMany({ where: { [column]: from, ...repointedRowsWhere(model) } }),
    )) as Row[];
    for (const row of rows) queue.push(...(await repointRow(repoint, row, merge, losers)));
  }
  await removeLosers(losers);
};
