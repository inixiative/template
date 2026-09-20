/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import type { User } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';

export type UserUpdatedPayload = { user: User };

export const userUpdated = makeAppEvent<UserUpdatedPayload>({
  cb: [
    async ({ user }) => {
      await enqueueJob('reconcileCustomerRefSegments', { customerModel: 'User', customerId: user.id });
    },
  ],
});
