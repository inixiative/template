/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { Segment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';
import { isReconcilable } from '#/modules/segment/services/reconcileSegment';

export type SegmentCreatedPayload = { segment: Segment };

export const segmentCreated = makeAppEvent<SegmentCreatedPayload>({
  cb: [
    async ({ segment }) => {
      if (isReconcilable(segment)) await enqueueJob('reconcileSegment', { segmentId: segment.id });
    },
  ],
});
