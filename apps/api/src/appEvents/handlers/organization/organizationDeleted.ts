/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:jobs
 */
import type { Organization } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type OrganizationDeletedPayload = { organization: Organization };

export const organizationDeleted = makeAppEvent<OrganizationDeletedPayload>({
  cb: [
    async ({ organization }) => {
      await enqueueSegmentReconcileForCustomers([
        {
          customerModel: 'Organization',
          customerId: organization.id,
        },
      ]);
    },
  ],
});
