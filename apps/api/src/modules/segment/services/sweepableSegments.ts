/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import { groupBy } from 'lodash-es';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { filterSegmentsWithoutRuleIssues } from '#/modules/segment/services/attachRuleHealthToSegments';
import { isReconcilableDynamicSegment } from '#/modules/segment/services/reconcileSegment';
import {
  sortByDependency,
  targetSegmentIdsBySegmentId,
} from '#/modules/segment/services/segmentReferenceGraph';

export const sweepableSegments = async (): Promise<Segment[]> => {
  const dynamic = await db.segment.findMany({
    where: { deletedAt: null, type: SegmentType.dynamic },
  });
  const sound = await filterSegmentsWithoutRuleIssues(dynamic.filter(isReconcilableDynamicSegment));
  const byOwner = groupBy(sound, (segment) => `${segment.ownerModel}:${segmentOwnerId(segment)}`);
  return Object.values(byOwner).flatMap((owned) =>
    sortByDependency(owned, targetSegmentIdsBySegmentId(owned)),
  );
};
