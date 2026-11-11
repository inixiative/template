/**
 * @atlas
 * @kind handler
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import type { HookOptions, ManyAction, SingleAction } from '@template/db';
import {
  DbAction,
  db,
  HookTiming,
  isNoOpUpdate,
  NOOP_FIELDS,
  type Prisma,
  registerDbHook,
} from '@template/db';
import { groupBy, keyBy } from 'lodash-es';
import { traversedRows } from '#/hooks/cache/constants/cacheReference';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { isManyAction } from '#/hooks/shared/hookRows';

// The traversed rows are read with tombstones: a target dying in this write still has keys to clear.
const queueTraversedCacheClear = async (
  model: Prisma.ModelName,
  records: Record<string, unknown>[],
) => {
  const rows = records.flatMap((record) => traversedRows(model, record));
  for (const [target, group] of Object.entries(groupBy(rows, 'model'))) {
    const loaded = (await db.withDeleted(() =>
      db.delegate(target).findMany({ where: { id: { in: group.map((row) => row.id) } } }),
    )) as Record<string, unknown>[];
    await queueCacheClear(target as Prisma.ModelName, loaded);
  }
};

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

    await queueCacheClear(model as Prisma.ModelName, records);
    await queueTraversedCacheClear(model as Prisma.ModelName, records);
  });
};
