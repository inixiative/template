import { DbAction, type HookOptions, HookTiming, type ManyAction, registerDbHook } from '@template/db';
import { applyOrderedListBulkDeletedAtChange } from '#/lib/prisma/orderedList';
import { orderedListRegistry } from '#/hooks/orderedList/registry';
import { isRegistered } from '#/hooks/orderedList/utils';

export const registerOrderedListUpdateManyHook = () => {
  // BEFORE: reject bulk writes to ordered fields. Bulk position arithmetic
  // (increment/decrement/set) can't be reconciled deterministically without
  // re-densifying away the caller's intent. Force callers to use a single
  // update() per row — the update hook handles sibling shifts atomically.
  registerDbHook(
    'orderedList:updateMany:before',
    '*',
    HookTiming.before,
    [DbAction.updateManyAndReturn],
    async (options) => {
      const { args, model } = options as HookOptions & { action: ManyAction };
      if (!isRegistered(model)) return;
      const data = (args as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      if (!data) return;

      const config = orderedListRegistry[model!];
      if (!config) return;

      for (const field of Object.keys(config)) {
        if (data[field] !== undefined) {
          throw new Error(
            `Ordered field "${model}.${field}" cannot be written via updateManyAndReturn. ` +
              `Use a single update() per row — the update hook will shift siblings atomically.`,
          );
        }
      }
    },
  );

  // AFTER: deletedAt-only changes need bulk compaction + sentinel assignment
  // across all touched scopes. Position writes are blocked by the BEFORE hook.
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
      if (data.deletedAt === undefined) return;

      await applyOrderedListBulkDeletedAtChange(model!, data, previous as Record<string, unknown>[]);
    },
  );
};
