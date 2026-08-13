import { DbAction, type HookOptions, HookTiming, registerDbHook, type SingleAction } from '@template/db';
import { queueOrderedListCacheInvalidation } from '#/hooks/orderedList/utils';
import { applyOrderedListUpsert } from '#/lib/prisma/orderedList';

export const registerOrderedListUpsertHook = () => {
  registerDbHook('orderedList:upsert', '*', HookTiming.before, [DbAction.upsert], async (options) => {
    const { args, previous, model, db: hookDb } = options as HookOptions & { action: SingleAction };
    const affected = await applyOrderedListUpsert(
      hookDb,
      model,
      args as Record<string, unknown>,
      previous as Record<string, unknown> | undefined,
    );
    queueOrderedListCacheInvalidation(hookDb, model, affected);
  });
};
