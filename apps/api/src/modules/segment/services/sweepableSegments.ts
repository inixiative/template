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
import { isContinuous } from '#/modules/segment/services/reconcileSegment';
import { buildReferenceMap, sortByDependency } from '#/modules/segment/services/segmentReferenceGraph';
import { soundSegments } from '#/modules/segment/services/withSegmentRuleIssues';

export const sweepableSegments = async (): Promise<Segment[]> => {
  const dynamic = await db.segment.findMany({ where: { deletedAt: null, type: SegmentType.dynamic } });
  const sound = await soundSegments(dynamic.filter(isContinuous));
  const byOwner = groupBy(sound, (segment) => `${segment.ownerModel}:${segmentOwnerId(segment)}`);
  return Object.values(byOwner).flatMap((owned) => sortByDependency(owned, buildReferenceMap(owned)));
};
