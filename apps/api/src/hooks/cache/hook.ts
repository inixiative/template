/**
 * @atlas
 * @kind handler
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import {
  DbAction,
  HookTiming,
  isNoOpUpdate,
  NOOP_FIELDS,
  type Prisma,
  registerDbHook,
} from '@template/db';
import { keyBy } from 'lodash-es';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { isManyAction } from '#/hooks/shared/hookRows';

const isUpdateAction = (action: DbAction): boolean =>
  action === DbAction.update || action === DbAction.updateManyAndReturn;

export const registerClearCacheHook = () => {
  const actions = [
    DbAction.create,
    DbAction.update,
    DbAction.delete,
    DbAction.upsert,
    DbAction.createManyAndReturn,
    DbAction.updateManyAndReturn,
    DbAction.deleteMany,
  ];

  registerDbHook('clearCache', '*', HookTiming.after, actions, async (options: HookOptions) => {
    const { model, action } = options;
    const records: Record<string, unknown>[] = [];

    if (isManyAction(action)) {
      const { result, previous } = options as HookOptions & { action: ManyAction };
      const results = (result ?? []) as Record<string, unknown>[];
      const previousById = keyBy(previous, 'id');

      for (const resultData of results) {
        const previousData = previousById[resultData.id as string];

        if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData, NOOP_FIELDS))
          continue;

        records.push(resultData);
        if (previousData) records.push(previousData);
      }
    } else {
      const { result, previous } = options as HookOptions & { action: SingleAction };
      const resultData = result as Record<string, unknown>;
      const previousData = previous as Record<string, unknown> | undefined;

      if (isUpdateAction(action) && isNoOpUpdate(model, resultData, previousData, NOOP_FIELDS)) {
        return;
      }

      records.push(resultData);
      if (previousData) records.push(previousData);
    }

    queueCacheClear(model as Prisma.ModelName, records);
  });
};
