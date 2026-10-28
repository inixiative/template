/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { DbAction, HookTiming, Prisma, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;

const clearBesideFull = (row: Row | undefined) => {
  if (row?.full !== true) return;
  row.role = null;
  row.entitlements = Prisma.DbNull;
};

export const registerFullDelegateHook = () => {
  registerDbHook(
    'fullDelegate',
    ['Token', 'Integration'],
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.update, DbAction.updateManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: Row | Row[] }).data) as Row[])
        clearBesideFull(row);
    },
  );

  registerDbHook(
    'fullDelegate:upsert',
    ['Token', 'Integration'],
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const { create, update } = args as { create?: Row; update?: Row };
      clearBesideFull(create);
      clearBesideFull(update);
    },
  );
};
