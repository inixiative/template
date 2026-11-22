/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type UserRedactedPayload = { userId: string };

export const userRedacted = makeAppEvent<UserRedactedPayload>({
  cb: [
    async ({ userId }) => {
      await enqueueSegmentReconcileForCustomers([
        {
          customerModel: 'User',
          customerId: userId,
        },
      ]);
    },
  ],
});
