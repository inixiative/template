/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import type { Organization } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';

export type OrganizationDeletedPayload = { organization: Organization };

export const organizationDeleted = makeAppEvent<OrganizationDeletedPayload>({
  cb: [
    async ({ organization }) => {
      await enqueueJob('reconcileCustomerRefSegments', { customerModel: 'Organization', customerId: organization.id });
    },
  ],
});
