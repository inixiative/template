import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { queueOrderedListCacheInvalidation } from '#/hooks/orderedList/utils';
import { applyOrderedListHardDelete } from '#/lib/prisma/orderedList';

export const registerOrderedListDeleteHook = () => {
  registerDbHook(
    'orderedList:delete',
    '*',
    HookTiming.after,
    [DbAction.delete, DbAction.deleteMany],
    async (options) => {
      const { previous, model, db: hookDb } = options as HookOptions;
      if (!previous) return;
      const rows = castArray(previous);
      const affected = await applyOrderedListHardDelete(hookDb, model, rows as Record<string, unknown>[]);
      queueOrderedListCacheInvalidation(hookDb, model, affected);
    },
  );
};
