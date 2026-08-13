import { DbAction, HookTiming, registerDbHook } from '@template/db';
import { extractRows, queueOrderedListCacheInvalidation } from '#/hooks/orderedList/utils';
import { applyOrderedListBatchCreate, applyOrderedListCreate } from '#/lib/prisma/orderedList';

export const registerOrderedListCreateHook = () => {
  registerDbHook(
    'orderedList:create',
    '*',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args, model }) => {
      const rows = extractRows(args);
      const affected =
        rows.length > 1
          ? await applyOrderedListBatchCreate(model, rows)
          : rows.length === 1
            ? await applyOrderedListCreate(model, rows[0]!)
            : [];
      queueOrderedListCacheInvalidation(model, affected);
    },
  );
};
