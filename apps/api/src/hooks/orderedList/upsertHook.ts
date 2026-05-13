import { DbAction, type HookOptions, HookTiming, type SingleAction, registerDbHook } from '@template/db';
import { applyOrderedListUpsert } from '#/lib/prisma/orderedList';
import { isRegistered } from '#/hooks/orderedList/utils';

export const registerOrderedListUpsertHook = () => {
  registerDbHook(
    'orderedList:upsert',
    '*',
    HookTiming.before,
    [DbAction.upsert],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: SingleAction };
      if (!isRegistered(model)) return;
      await applyOrderedListUpsert(
        model!,
        args as Record<string, unknown>,
        previous as Record<string, unknown> | undefined,
      );
    },
  );
};
