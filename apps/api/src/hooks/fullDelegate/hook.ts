/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import {
  DbAction,
  db,
  HookTiming,
  registerDbHook,
  resolveFalsePolymorphismRef,
} from '@template/db';
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

const targetIdOf = (model: string, row: Row): string =>
  (row.targetId ??
    row[
      resolveFalsePolymorphismRef({ model: 'Entitlement', axis: 'targetModel', value: model }) ??
        'targetId'
    ]) as string;

// A full delegate is its owner whole, so no write of any kind gives it a row of its own.
const refuseRowsOnFull = async (rows: Row[]) => {
  const byModel = groupBy(
    rows.filter((row) => isDelegateModel(row.targetModel)),
    'targetModel',
  );
  for (const [model, group] of Object.entries(byModel)) {
    const full = await db.delegate(model).findFirst({
      where: { id: { in: group.map((row) => targetIdOf(model, row)) }, full: true },
      select: { id: true },
    });
    if (full) throw makeError({ status: 422, message: 'full takes no entitlements' });
  }
};

export const registerFullDelegateHook = () => {
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
