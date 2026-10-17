/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { Segment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { publishMembershipChanges } from '#/modules/segment/services/publishMembershipChanges';

export type SegmentDeletedPayload = { segment: Segment; customerRefIds: string[] };

export const segmentDeleted = makeAppEvent<SegmentDeletedPayload>({
  cb: [
    async ({ segment, customerRefIds }) => {
      await publishMembershipChanges([{ segment, diff: { added: [], removed: customerRefIds } }]);
    },
  ],
});
