/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { DbAction, db, HookTiming, registerDbHook, rowPolymorphicAxisPointsAt } from '@template/db';
import type { EntitlementTargetModel } from '@template/db/generated/client/enums';
import { castArray, groupBy } from 'lodash-es';
import { makeError } from '#/lib/errors';

type Row = Record<string, unknown>;

const DELEGATE_MODELS: readonly EntitlementTargetModel[] = ['Token', 'Integration'];

const clearRoleBesideFull = (row: Row | undefined) => {
  if (row?.full === true) row.role = null;
};

const isDelegateModel = (model: unknown): model is EntitlementTargetModel =>
  DELEGATE_MODELS.includes(model as EntitlementTargetModel);

const targetIdOf = (row: Row): string =>
  rowPolymorphicAxisPointsAt(row, 'Entitlement', 'targetModel')?.id as string;

// A full delegate is its owner whole, so no write of any kind gives it a row of its own.
const refuseRowsOnFull = async (rows: Row[]) => {
  const byModel = groupBy(
    rows.filter((row) => isDelegateModel(row.targetModel)),
    'targetModel',
  );
  for (const [model, group] of Object.entries(byModel)) {
    const full = await db.delegate(model).findFirst({
      where: { id: { in: group.map(targetIdOf) }, full: true },
      select: { id: true },
    });
    if (full) throw makeError({ status: 422, message: 'full takes no entitlements' });
  }
};

const tombstoneRowsOnFull = async (rows: Row[]) => {
  const byModel = groupBy(
    rows.filter((row) => row.deletedAt == null && isDelegateModel(row.targetModel)),
    'targetModel',
  );
  for (const [model, group] of Object.entries(byModel)) {
    const full = await db.delegate(model).findMany({
      where: { id: { in: group.map(targetIdOf) }, full: true },
      select: { id: true },
    });
    if (!full.length) continue;
    const fullIds = new Set(full.map((row) => row.id as string));
    await db.entitlement.updateManyAndReturn({
      where: {
        id: {
          in: group.filter((row) => fullIds.has(targetIdOf(row))).map((row) => row.id as string),
        },
      },
      data: { deletedAt: new Date() },
    });
  }
};

export const registerFullDelegateTakesNoRoleOrEntitlementsHook = () => {
  registerDbHook(
    'fullDelegate',
    DELEGATE_MODELS,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.update, DbAction.updateManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: Row | Row[] }).data) as Row[])
        clearRoleBesideFull(row);
    },
  );

  registerDbHook(
    'fullDelegate:upsert',
    DELEGATE_MODELS,
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const { create, update } = args as { create?: Row; update?: Row };
      clearRoleBesideFull(create);
      clearRoleBesideFull(update);
    },
  );

  registerDbHook(
    'fullDelegate:refuseEntitlements',
    'Entitlement',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => refuseRowsOnFull(castArray((args as { data: Row | Row[] }).data) as Row[]),
  );

  registerDbHook(
    'fullDelegate:revivedEntitlements',
    'Entitlement',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn],
    async ({ result }) => tombstoneRowsOnFull(castArray(result ?? []) as Row[]),
  );

  // A full delegate is its owner whole; the entitlements it held beside that go.
  registerDbHook(
    'fullDelegate:entitlements',
    DELEGATE_MODELS,
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, result }) => {
      const full = (castArray(result ?? []) as Row[]).filter(
        (row) => row.full === true && row.deletedAt == null,
      );
      if (!full.length) return;
      await db.entitlement.updateManyAndReturn({
        where: {
          targetModel: model as EntitlementTargetModel,
          targetId: { in: full.map((row) => row.id as string) },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
    },
  );
};
