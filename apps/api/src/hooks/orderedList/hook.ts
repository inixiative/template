import { DbAction, type HookOptions, HookTiming, type ManyAction, registerDbHook, type SingleAction } from '@template/db';
import {
  applyOrderedListCreate,
  applyOrderedListHardDelete,
  applyOrderedListReDensify,
  applyOrderedListUpdate,
  applyOrderedListUpsert,
} from '#/lib/prisma/orderedList';
import { orderedListRegistry } from '#/hooks/orderedList/registry';

const extractRows = (args: unknown): Record<string, unknown>[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return Array.isArray(a.data) ? (a.data as Record<string, unknown>[]) : [a.data as Record<string, unknown>];
};

const isRegistered = (model: string | undefined): boolean =>
  !!model && !!orderedListRegistry[model];

export const registerOrderedListHook = () => {
  // --- BEFORE: create / createManyAndReturn ---
  registerDbHook(
    'orderedList:create',
    '*',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args, model }) => {
      if (!isRegistered(model)) return;
      for (const row of extractRows(args)) {
        await applyOrderedListCreate(model!, row);
      }
    },
  );

  // --- BEFORE: update (single) ---
  registerDbHook(
    'orderedList:update',
    '*',
    HookTiming.before,
    [DbAction.update],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: SingleAction };
      if (!isRegistered(model) || !previous) return;
      const data = (args as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      if (!data) return;
      await applyOrderedListUpdate(model!, data, previous as Record<string, unknown>);
    },
  );

  // --- BEFORE: updateManyAndReturn (soft-delete/restore per-row) ---
  registerDbHook(
    'orderedList:updateMany:before',
    '*',
    HookTiming.before,
    [DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: ManyAction };
      if (!isRegistered(model)) return;
      const data = (args as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      if (!data || !previous || !Array.isArray(previous)) return;

      // Handle soft-delete/restore per-row (these need before-hook to avoid unique violations)
      const touchesSortOrder = Object.keys(orderedListRegistry[model!] ?? {}).some((f) => data[f] !== undefined);
      const touchesDeletedAt = data.deletedAt !== undefined;

      if (touchesDeletedAt) {
        for (const prev of previous) {
          const rowData = { ...data };
          await applyOrderedListUpdate(model!, rowData, prev as Record<string, unknown>);
        }
      }

      // If touching sortOrder directly (increment/decrement/set), let the write happen
      // and re-densify in the after-hook
      if (touchesSortOrder && !touchesDeletedAt) return;
    },
  );

  // --- AFTER: updateManyAndReturn (re-densify for bulk sortOrder manipulation) ---
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

      // Only re-densify if sortOrder was directly manipulated (not via soft-delete/restore)
      const touchesDeletedAt = data.deletedAt !== undefined;
      if (touchesDeletedAt) return;

      await applyOrderedListReDensify(model!, data, previous as Record<string, unknown>[]);
    },
  );

  // --- BEFORE: upsert ---
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

  // --- AFTER: delete / deleteMany (compact after row is gone) ---
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
      // compaction doesn't shift positions of items we haven't processed yet
      const sorted = [...rows].sort((a, b) => {
        const field = orderFields[0] ?? 'sortOrder';
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
