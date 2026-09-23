/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma, feature:segment
 */
import { db, type Prisma } from '@template/db';
import type { FeatureFlag } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import { createVariant } from '#/modules/featureFlag/services/writeVariant';

/** Writes the flag; a boolean flag also gets its `on` rule over an internal open segment so create -> toggle is the whole kill-switch path. */
export const createFeatureFlag = async (data: Prisma.FeatureFlagUncheckedCreateInput): Promise<FeatureFlag> =>
  db.txn(async () => {
    const flag = await db.featureFlag.create({ data });
    if (flag.valueType === 'boolean') {
      await createVariant(flag, {
        label: 'on',
        valueBoolean: true,
        internalSegment: { type: SegmentType.dynamic, conditions: { all: [] } },
      });
    }
    return flag;
  });
