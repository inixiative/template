/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Db, db as defaultDb } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import { groupBy } from 'lodash-es';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { isContinuous } from '#/modules/segment/services/reconcileSegment';
import { buildReferenceMap, sortByDependency } from '#/modules/segment/services/segmentReferenceGraph';
import { soundSegments } from '#/modules/segment/services/withSegmentRuleIssues';

export const sweepableSegments = async (db: Db = defaultDb): Promise<Segment[]> => {
  const dynamic = await db.segment.findMany({ where: { deletedAt: null, type: SegmentType.dynamic } });
  const sound = await soundSegments(dynamic.filter(isContinuous), db);
  const byOwner = groupBy(sound, (segment) => `${segment.ownerModel}:${segmentOwnerId(segment)}`);
  return Object.values(byOwner).flatMap((owned) => sortByDependency(owned, buildReferenceMap(owned)));
};
