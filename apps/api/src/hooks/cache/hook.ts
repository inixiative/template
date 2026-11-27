/**
 * @atlas
 * @kind handler
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import type { HookOptions } from '@template/db';
import { fetchParentRows, HookTiming, type Prisma, registerDbHook } from '@template/db';
import { groupBy } from 'lodash-es';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { ALL_MUTATION_ACTIONS, changedPairs } from '#/hooks/shared/hookRows';

const queueParentCacheClear = async (
  model: Prisma.ModelName,
  records: Record<string, unknown>[],
) => {
  const parents = (await fetchParentRows(model, records)).filter((parent) => parent !== null);
  for (const [parentModel, group] of Object.entries(groupBy(parents, 'model')))
    await queueCacheClear(
      parentModel as Prisma.ModelName,
      group.map((parent) => parent.row),
    );
};

export const registerClearCacheHook = () => {
  registerDbHook(
    'clearCache',
    '*',
    HookTiming.after,
    ALL_MUTATION_ACTIONS,
    async (options: HookOptions) => {
      const records = changedPairs(options, { skipNoOp: true }).flatMap(({ result, previous }) => [
        ...(result ? [result] : []),
        ...(previous ? [previous] : []),
      ]);
      if (records.length === 0) return;

      await queueCacheClear(options.model as Prisma.ModelName, records);
      await queueParentCacheClear(options.model as Prisma.ModelName, records);
    },
  );
};
