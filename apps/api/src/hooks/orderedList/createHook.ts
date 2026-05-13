import { DbAction, HookTiming, registerDbHook } from '@template/db';
import { applyOrderedListBatchCreate, applyOrderedListCreate } from '#/lib/prisma/orderedList';
import { extractRows, isRegistered } from '#/hooks/orderedList/utils';

export const registerOrderedListCreateHook = () => {
  registerDbHook(
    'orderedList:create',
    '*',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args, model }) => {
      if (!isRegistered(model)) return;
      const rows = extractRows(args);
      if (rows.length > 1) {
        await applyOrderedListBatchCreate(model!, rows);
      } else if (rows.length === 1) {
        await applyOrderedListCreate(model!, rows[0]!);
      }
    },
  );
};
