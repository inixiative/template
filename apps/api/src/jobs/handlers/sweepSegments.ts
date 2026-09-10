/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment
 */
import { db } from '@template/db';
import { SegmentType } from '@template/db/generated/client/enums';
import { log } from '@template/shared/logger';
import { groupBy } from 'lodash-es';
import { enqueueJob } from '#/jobs/enqueue';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { isContinuous } from '#/modules/segment/services/reconcileSegment';
import { applyPauseVerdicts } from '#/modules/segment/services/segmentReconcilePause';
import { buildReferenceMap, sortByDependency } from '#/modules/segment/services/segmentReferenceGraph';

export const sweepSegments = makeSingletonJob(async () => {
  const segments = await db.segment.findMany({ where: { deletedAt: null, type: SegmentType.dynamic } });
  const byOwner = groupBy(segments, (segment) => `${segment.ownerModel}:${segmentOwnerId(segment)}`);

  let enqueued = 0;
  for (const owned of Object.values(byOwner)) {
    const verdicts = await applyPauseVerdicts(owned, db);
    const runnable = verdicts.filter(isContinuous);
    for (const segment of sortByDependency(runnable, buildReferenceMap(runnable))) {
      await enqueueJob('reconcileSegment', { segmentId: segment.id });
      enqueued += 1;
    }
  }
  log.info(`sweepSegments: enqueued ${enqueued} of ${segments.length} dynamic segments`);
});
