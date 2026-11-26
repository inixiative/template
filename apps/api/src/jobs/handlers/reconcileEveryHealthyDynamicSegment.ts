/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment
 */
import { log } from '@template/shared/logger';
import { enqueueJob } from '#/jobs/enqueue';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { JobLane } from '#/jobs/types';
import { fetchHealthyDynamicSegmentsInDependencyOrder } from '#/modules/segment/services/fetchHealthyDynamicSegmentsInDependencyOrder';

export const reconcileEveryHealthyDynamicSegment = makeSingletonJob(async () => {
  const segments = await fetchHealthyDynamicSegmentsInDependencyOrder();
  for (const segment of segments)
    await enqueueJob('reconcileSegment', { segmentId: segment.id }, { lane: JobLane.slow });
  log.info(
    `reconcileEveryHealthyDynamicSegment: enqueued ${segments.length} healthy dynamic segments`,
  );
});
