/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import type { Space } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';

export type SpaceDeletedPayload = { space: Space };

export const spaceDeleted = makeAppEvent<SpaceDeletedPayload>({
  cb: [
    async ({ space }) => {
      await enqueueJob('reconcileCustomerRefSegments', { customerModel: 'Space', customerId: space.id });
    },
  ],
});
