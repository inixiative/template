import { db, DbAction, type HookOptions, HookTiming, registerDbHook, type SingleAction } from '@template/db';
import {
  applyOrderedListDefaults,
  applyOrderedListRestore,
  getOrderedListConfig,
  setOrderedListRegistry,
} from '#/lib/prisma/orderedList';
import { orderedListRegistry } from '#/hooks/orderedList/registry';

setOrderedListRegistry(orderedListRegistry);

const extractRows = (args: unknown): Record<string, unknown>[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return Array.isArray(a.data) ? (a.data as Record<string, unknown>[]) : [a.data as Record<string, unknown>];
};

export const registerOrderedListHook = () => {
  registerDbHook(
    'orderedList:create',
    '*',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args, model }) => {
      if (!model || !getOrderedListConfig(model)) return;
      const delegate = (db as Record<string, unknown>)[model[0].toLowerCase() + model.slice(1)];
      if (!delegate) return;
      for (const row of extractRows(args)) {
        await applyOrderedListDefaults(delegate as Parameters<typeof applyOrderedListDefaults>[0], row, false);
      }
    },
  );

  registerDbHook(
    'orderedList:restore',
    '*',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous, model } = options as HookOptions & { action: SingleAction };
      if (!model || !getOrderedListConfig(model)) return;
      if (!args || typeof args !== 'object') return;
      const data = (args as Record<string, unknown>).data as Record<string, unknown> | undefined;
      if (!data || !previous) return;
      const delegate = (db as Record<string, unknown>)[model[0].toLowerCase() + model.slice(1)];
      if (!delegate) return;
      const id = (previous as Record<string, unknown>).id as string;
      await applyOrderedListRestore(
        delegate as Parameters<typeof applyOrderedListRestore>[0],
        data,
        previous as Record<string, unknown>,
        id,
      );
    },
  );
};
