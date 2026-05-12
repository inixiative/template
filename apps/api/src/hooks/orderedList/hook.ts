import { DbAction, type HookOptions, HookTiming, registerDbHook, type SingleAction } from '@template/db';
import {
  applyOrderedListDefaults,
  applyOrderedListHardDelete,
  applyOrderedListRestore,
  applyOrderedListSoftDelete,
  applyOrderedListUpsert,
} from '#/lib/prisma/orderedList';
import { orderedListRegistry } from '#/hooks/orderedList/registry';

const extractRows = (args: unknown): Record<string, unknown>[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return Array.isArray(a.data) ? (a.data as Record<string, unknown>[]) : [a.data as Record<string, unknown>];
};

export const registerOrderedListHook = () => {
  // Create / createManyAndReturn — assign sortOrder (append or insert-at)
  registerDbHook(
    'orderedList:create',
    '*',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args, model }) => {
      if (!model || !orderedListRegistry[model]) return;
      for (const row of extractRows(args)) {
        await applyOrderedListDefaults(model, row);
      }
    },
  );

  // Update — soft delete (→ negative + compact) or restore (→ append to end)
  registerDbHook(
    'orderedList:update',
    '*',
    HookTiming.before,
    [DbAction.update],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: SingleAction };
      if (!model || !orderedListRegistry[model]) return;
      if (!args || typeof args !== 'object' || !previous) return;
      const data = (args as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (!data) return;
      await applyOrderedListSoftDelete(model, data, previous as Record<string, unknown>);
      await applyOrderedListRestore(model, data, previous as Record<string, unknown>);
    },
  );

  // UpdateManyAndReturn — same as update but previous is an array
  registerDbHook(
    'orderedList:updateMany',
    '*',
    HookTiming.before,
    [DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: 'updateManyAndReturn' };
      if (!model || !orderedListRegistry[model]) return;
      if (!args || typeof args !== 'object') return;
      const data = (args as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (!data || !previous || !Array.isArray(previous)) return;

      // updateManyAndReturn applies the same data to all matched rows.
      // Process each previous row against the shared data to detect
      // soft-delete / restore transitions per-row.
      for (const prev of previous) {
        const rowData = { ...data };
        await applyOrderedListSoftDelete(model, rowData, prev as Record<string, unknown>);
        await applyOrderedListRestore(model, rowData, prev as Record<string, unknown>);
      }
    },
  );

  // Upsert — create path or update path depending on whether previous exists
  registerDbHook(
    'orderedList:upsert',
    '*',
    HookTiming.before,
    [DbAction.upsert],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: SingleAction };
      if (!model || !orderedListRegistry[model]) return;
      if (!args || typeof args !== 'object') return;
      await applyOrderedListUpsert(
        model,
        args as Record<string, unknown>,
        previous as Record<string, unknown> | undefined,
      );
    },
  );

  // Delete — compact siblings after hard delete
  registerDbHook(
    'orderedList:delete',
    '*',
    HookTiming.after,
    [DbAction.delete, DbAction.deleteMany],
    async (options) => {
      const { previous, model } = options as HookOptions;
      if (!model || !orderedListRegistry[model]) return;
      if (!previous) return;

      const rows = Array.isArray(previous) ? previous : [previous];
      for (const row of rows) {
        await applyOrderedListHardDelete(model, row as Record<string, unknown>);
      }
    },
  );
};
