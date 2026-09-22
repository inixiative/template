import { DbAction, db, type HookOptions, HookTiming, isNoOpUpdate, NOOP_FIELDS, registerDbHook } from '@template/db';
import type { FeatureFlag } from '@template/db/generated/client/client';
import { castArray, keyBy, uniqBy } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
import { flagOwnerOf } from '#/modules/featureFlag/services/resolveFlags';

type Row = Record<string, unknown> & { id: string };

const flagsOf = async (model: string, rows: Row[]): Promise<FeatureFlag[]> => {
  if (model === 'FeatureFlag') return rows as unknown as FeatureFlag[];
  const ids = [...new Set(rows.map((row) => row.featureFlagId as string))];
  return db.featureFlag.findMany({ where: { id: { in: ids } } });
};

export const registerFeatureFlagChangedHook = () => {
  registerDbHook(
    'featureFlagChanged',
    ['FeatureFlag', 'FeatureFlagVariant'],
    HookTiming.after,
    [
      DbAction.create,
      DbAction.createManyAndReturn,
      DbAction.update,
      DbAction.updateManyAndReturn,
      DbAction.upsert,
      DbAction.delete,
      DbAction.deleteMany,
    ],
    async ({ model, action, result, previous }: HookOptions) => {
      const previousById = keyBy(castArray((previous ?? []) as Row[]), 'id');
      const rows = castArray((result ?? previous ?? []) as Row[]).filter((row) => {
        const before = previousById[row.id];
        const isUpdate = action === DbAction.update || action === DbAction.updateManyAndReturn;
        return !(isUpdate && before && isNoOpUpdate(model, row, before, NOOP_FIELDS));
      });
      if (!rows.length) return;
      for (const flag of uniqBy(await flagsOf(model, rows), 'id')) {
        await emitAppEvent('featureFlag.changed', { ...flagOwnerOf(flag), slug: flag.slug });
      }
    },
  );
};
