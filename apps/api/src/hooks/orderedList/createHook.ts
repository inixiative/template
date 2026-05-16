import { DbAction, HookTiming, registerDbHook } from '@template/db';
import { extractRows } from '#/hooks/orderedList/utils';
import { applyOrderedListBatchCreate, applyOrderedListCreate } from '#/lib/prisma/orderedList';

export const registerOrderedListCreateHook = () => {
  registerDbHook(
    'orderedList:create',
    '*',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args, model }) => {
      const rows = extractRows(args);
      if (rows.length > 1) {
        await applyOrderedListBatchCreate(model, rows);
      } else if (rows.length === 1) {
        await applyOrderedListCreate(model, rows[0]!);
      }
    },
  );
};
