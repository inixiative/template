import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { toArray } from '@template/shared/utils';
import { queueOrderedListCacheInvalidation } from '#/hooks/orderedList/utils';
import { applyOrderedListHardDelete } from '#/lib/prisma/orderedList';

export const registerOrderedListDeleteHook = () => {
  registerDbHook(
    'orderedList:delete',
    '*',
    HookTiming.after,
    [DbAction.delete, DbAction.deleteMany],
    async (options) => {
      const { previous, model } = options as HookOptions;
      if (!previous) return;
      const rows = toArray(previous);
      const affected = await applyOrderedListHardDelete(model, rows as Record<string, unknown>[]);
      queueOrderedListCacheInvalidation(model, affected);
    },
  );
};
