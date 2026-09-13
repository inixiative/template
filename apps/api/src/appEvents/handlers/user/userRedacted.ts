/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';

export type UserRedactedPayload = { userId: string };

export const userRedacted = makeAppEvent<UserRedactedPayload>({
  cb: [
    async ({ userId }) => {
      await enqueueJob('reconcileCustomerRefSegments', { customerModel: 'User', customerId: userId });
    },
  ],
});
