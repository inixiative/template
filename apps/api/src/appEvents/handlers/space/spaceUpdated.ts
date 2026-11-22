/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import type { Space } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type SpaceUpdatedPayload = { space: Space };

export const spaceUpdated = makeAppEvent<SpaceUpdatedPayload>({
  cb: [
    async ({ space }) => {
      await enqueueSegmentReconcileForCustomers([
        {
          customerModel: 'Space',
          customerId: space.id,
        },
      ]);
    },
  ],
});
