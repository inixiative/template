/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:email, primitive:jobs
 */
import type { CommunicationLog } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';

export type CommunicationSettledPayload = { communicationLog: CommunicationLog };

export const communicationSettled = makeAppEvent<CommunicationSettledPayload>({
  cb: [
    async ({ communicationLog }) => {
      if (!communicationLog.recipientUserId) return;
      await enqueueJob('reconcileCustomerRefSegments', {
        customerModel: 'User',
        customerId: communicationLog.recipientUserId,
      });
    },
  ],
});
