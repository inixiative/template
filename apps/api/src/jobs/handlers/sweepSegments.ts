/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment
 */
import { log } from '@template/shared/logger';
import { enqueueJob } from '#/jobs/enqueue';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { sweepableSegments } from '#/modules/segment/services/sweepableSegments';

export const sweepSegments = makeSingletonJob(async () => {
  const segments = await sweepableSegments();
  for (const segment of segments) await enqueueJob('reconcileSegment', { segmentId: segment.id });
  log.info(`sweepSegments: enqueued ${segments.length} sound dynamic segments`);
});
