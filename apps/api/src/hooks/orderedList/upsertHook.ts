import { DbAction, type HookOptions, HookTiming, registerDbHook, type SingleAction } from '@template/db';
import { applyOrderedListUpsert } from '#/lib/prisma/orderedList';

export const registerOrderedListUpsertHook = () => {
  registerDbHook('orderedList:upsert', '*', HookTiming.before, [DbAction.upsert], async (options) => {
    const { args, previous, model } = options as HookOptions & { action: SingleAction };
    await applyOrderedListUpsert(
      model,
      args as Record<string, unknown>,
      previous as Record<string, unknown> | undefined,
    );
  });
};
