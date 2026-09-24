import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  type Prisma,
  registerDbHook,
  type SingleAction,
} from '@template/db';
import type { FeatureFlag } from '@template/db/generated/client/client';
import { castArray } from 'lodash-es';
import { type FeatureFlagRow, validateFeatureFlagRow } from '#/modules/featureFlag/validations/validateFeatureFlagRow';

export const registerFeatureFlagHook = () => {
  registerDbHook(
    'featureFlag:create',
    'FeatureFlag',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: FeatureFlagRow | FeatureFlagRow[] }).data)) {
        await validateFeatureFlagRow(row);
      }
    },
  );

  registerDbHook(
    'featureFlag:update',
    'FeatureFlag',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous } = options as HookOptions<FeatureFlag> & { previous?: FeatureFlag | FeatureFlag[] };
      const a = args as { where?: Prisma.FeatureFlagWhereInput; data?: FeatureFlagRow | FeatureFlagRow[] };
      const [row] = castArray(a.data ?? []);
      if (!row) return;
      const befores = previous ? castArray(previous) : await db.featureFlag.findMany({ where: a.where });
      for (const before of befores) await validateFeatureFlagRow(row, before);
    },
  );

  registerDbHook('featureFlag:upsert', 'FeatureFlag', HookTiming.before, [DbAction.upsert], async (options) => {
    const { args, previous } = options as HookOptions & { action: SingleAction; previous?: FeatureFlag };
    const a = args as { where?: Prisma.FeatureFlagWhereInput; create?: FeatureFlagRow; update?: FeatureFlagRow };
    if (a.create) await validateFeatureFlagRow(a.create);
    if (a.update) {
      const before = previous ?? (await db.featureFlag.findMany({ where: a.where }))[0];
      if (before) await validateFeatureFlagRow(a.update, before);
    }
  });
};
