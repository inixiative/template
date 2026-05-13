import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { applyOrderedListHardDelete } from '#/lib/prisma/orderedList';
import { isRegistered } from '#/hooks/orderedList/utils';
import { orderedListRegistry } from '#/hooks/orderedList/registry';

export const registerOrderedListDeleteHook = () => {
  registerDbHook(
    'orderedList:delete',
    '*',
    HookTiming.after,
    [DbAction.delete, DbAction.deleteMany],
    async (options) => {
      const { previous, model } = options as HookOptions;
      if (!isRegistered(model) || !previous) return;

      const rows = Array.isArray(previous) ? previous : [previous];
      const config = orderedListRegistry[model!];
      const orderFields = config ? Object.keys(config) : [];

      // Process in descending order (by first registered field) so each
      // compaction doesn't shift positions of items we haven't processed yet.
      const sorted = [...rows].sort((a, b) => {
        const field = orderFields[0] ?? 'position';
        const aOrder = ((a as Record<string, unknown>)[field] as number) ?? 0;
        const bOrder = ((b as Record<string, unknown>)[field] as number) ?? 0;
        return bOrder - aOrder;
      });

      for (const row of sorted) {
        await applyOrderedListHardDelete(model!, row as Record<string, unknown>);
      }
    },
  );
};
