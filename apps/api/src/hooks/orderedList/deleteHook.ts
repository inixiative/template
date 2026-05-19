import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
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
      const rows = Array.isArray(previous) ? previous : [previous];
      const affected = await applyOrderedListHardDelete(model, rows as Record<string, unknown>[]);
      queueOrderedListCacheInvalidation(model, affected);
    },
  );
};
