import { DbAction, type HookOptions, HookTiming, registerDbHook, type SingleAction } from '@template/db';
import { queueOrderedListCacheInvalidation } from '#/hooks/orderedList/utils';
import { applyOrderedListUpdate } from '#/lib/prisma/orderedList';

export const registerOrderedListUpdateHook = () => {
  registerDbHook('orderedList:update', '*', HookTiming.before, [DbAction.update], async (options) => {
    const { args, previous, model } = options as HookOptions & { action: SingleAction };
    if (!previous) return;
    const data = (args as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (!data) return;
    const affected = await applyOrderedListUpdate(model, data, previous as Record<string, unknown>);
    queueOrderedListCacheInvalidation(model, affected);
  });
};
