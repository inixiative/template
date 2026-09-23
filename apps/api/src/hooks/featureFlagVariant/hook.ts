import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  type Prisma,
  registerDbHook,
  type SingleAction,
} from '@template/db';
import type { FeatureFlagVariant } from '@template/db/generated/client/client';
import { castArray, keyBy } from 'lodash-es';
import {
  type FeatureFlagVariantRow,
  validateFeatureFlagVariantRow,
} from '#/modules/featureFlag/validations/validateFeatureFlagVariantRow';

type Row = Record<string, unknown>;

const internalSegmentWhere = (segmentId: string, deletedAt: Date | null) => ({
  id: segmentId,
  featureFlagInternal: true,
  deletedAt,
});

const cascadeInternalSegment = async ({ action, args, result, previous }: HookOptions) => {
  const data = (action === DbAction.upsert ? (args as { update?: Row }).update : (args as { data?: Row }).data) as
    | Row
    | undefined;
  if (!data || !('deletedAt' in data)) return;
  const previousById = keyBy(castArray((previous ?? []) as FeatureFlagVariant[]), 'id');
  for (const variant of castArray(result) as FeatureFlagVariant[]) {
    const prior = previousById[variant.id];
    if (!variant.segmentId) continue;
    if (variant.deletedAt === null && prior?.deletedAt) {
      await db.segment.updateManyAndReturn({
        where: internalSegmentWhere(variant.segmentId, prior.deletedAt),
        data: { deletedAt: null },
      });
    } else if (variant.deletedAt && !prior?.deletedAt) {
      await db.segment.updateManyAndReturn({
        where: internalSegmentWhere(variant.segmentId, null),
        data: { deletedAt: variant.deletedAt },
      });
    }
  }
};

export const registerFeatureFlagVariantHook = () => {
  registerDbHook(
    'featureFlagVariant:create',
    'FeatureFlagVariant',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: FeatureFlagVariantRow | FeatureFlagVariantRow[] }).data)) {
        await validateFeatureFlagVariantRow(row);
      }
    },
  );

  registerDbHook(
    'featureFlagVariant:update',
    'FeatureFlagVariant',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous } = options as HookOptions<FeatureFlagVariant> & {
        previous?: FeatureFlagVariant | FeatureFlagVariant[];
      };
      const a = args as {
        where?: Prisma.FeatureFlagVariantWhereInput;
        data?: FeatureFlagVariantRow | FeatureFlagVariantRow[];
      };
      const [row] = castArray(a.data ?? []);
      if (!row) return;
      const befores = previous ? castArray(previous) : await db.featureFlagVariant.findMany({ where: a.where });
      for (const before of befores) await validateFeatureFlagVariantRow(row, before);
    },
  );

  registerDbHook(
    'featureFlagVariant:upsert',
    'FeatureFlagVariant',
    HookTiming.before,
    [DbAction.upsert],
    async (options) => {
      const { args, previous } = options as HookOptions & { action: SingleAction; previous?: FeatureFlagVariant };
      const a = args as {
        where?: Prisma.FeatureFlagVariantWhereInput;
        create?: FeatureFlagVariantRow;
        update?: FeatureFlagVariantRow;
      };
      if (a.create) await validateFeatureFlagVariantRow(a.create);
      if (a.update) {
        const before = previous ?? (await db.featureFlagVariant.findMany({ where: a.where }))[0];
        if (before) await validateFeatureFlagVariantRow(a.update, before);
      }
    },
  );

  registerDbHook(
    'featureFlagVariant:internalSegment',
    'FeatureFlagVariant',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    cascadeInternalSegment,
  );
};
