import { DbAction, type HookOptions, HookTiming, type ManyAction, registerDbHook } from '@template/db';
import { applyOrderedListBulkDeletedAtChange, applyOrderedListReDensify } from '#/lib/prisma/orderedList';
import { isRegistered } from '#/hooks/orderedList/utils';

export const registerOrderedListUpdateManyHook = () => {
  // --- AFTER: updateManyAndReturn ---
  // Handles two cases:
  //   deletedAt changes  → re-densify live rows + assign negatives to deleted (or restore to end)
  //   bulk position writes → re-densify so gaps/collisions left by increment/decrement are closed
  registerDbHook(
    'orderedList:updateMany:after',
    '*',
    HookTiming.after,
    [DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: ManyAction };
      if (!isRegistered(model)) return;
      const data = (args as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      if (!data || !previous || !Array.isArray(previous)) return;

      const touchesDeletedAt = data.deletedAt !== undefined;

      if (touchesDeletedAt) {
        await applyOrderedListBulkDeletedAtChange(model!, data, previous as Record<string, unknown>[]);
      } else {
        await applyOrderedListReDensify(model!, data, previous as Record<string, unknown>[]);
      }
    },
  );
};
