/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 */

import type { Prisma } from '@template/db';
import { DbAction, HookTiming, registerDbHook } from '@template/db';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
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
      const affected =
        rows.length > 1
          ? await applyOrderedListBatchCreate(model, rows)
          : rows.length === 1
            ? await applyOrderedListCreate(model, rows[0]!)
            : [];
      queueCacheClear(model as Prisma.ModelName, affected);
    },
  );
};
