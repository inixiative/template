/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { Segment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';
import { segmentNeedsReconcile } from '#/modules/segment/services/reconcileSegment';

export type SegmentUpdatedPayload = { segment: Segment; previous: Segment };

export const segmentUpdated = makeAppEvent<SegmentUpdatedPayload>({
  cb: [
    async ({ segment, previous }) => {
      if (segmentNeedsReconcile(segment, previous)) await enqueueJob('reconcileSegment', { segmentId: segment.id });
    },
  ],
});
