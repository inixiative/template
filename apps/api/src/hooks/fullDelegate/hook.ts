/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { EntitlementTargetModel } from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;

const DELEGATE_MODELS: readonly EntitlementTargetModel[] = ['Token', 'Integration'];

const clearRoleBesideFull = (row: Row | undefined) => {
  if (row?.full === true) row.role = null;
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
