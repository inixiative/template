/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:email, primitive:jobs
 */
import type { CommunicationLog } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type CommunicationOutcomeRecordedPayload = { communicationLog: CommunicationLog };

export const communicationOutcomeRecorded = makeAppEvent<CommunicationOutcomeRecordedPayload>({
  cb: [
    async ({ communicationLog }) => {
      if (!communicationLog.recipientUserId) return;
      await enqueueSegmentReconcileForCustomers([
        {
          customerModel: 'User',
          customerId: communicationLog.recipientUserId,
        },
      ]);
    },
  ],
});
