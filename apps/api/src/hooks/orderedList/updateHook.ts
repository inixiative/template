import { DbAction, type HookOptions, HookTiming, type SingleAction, registerDbHook } from '@template/db';
import { applyOrderedListUpdate } from '#/lib/prisma/orderedList';

export const registerOrderedListUpdateHook = () => {
  registerDbHook(
    'orderedList:update',
    '*',
    HookTiming.before,
    [DbAction.update],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: SingleAction };
      if (!previous) return;
      const data = (args as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      if (!data) return;
      await applyOrderedListUpdate(model, data, previous as Record<string, unknown>);
    },
  );
};
