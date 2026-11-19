/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { CustomerRelationship } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import {
  customerSideOfRow,
  enqueueSegmentReconcileForCustomers,
} from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type CustomerRelationshipCreatedPayload = { customerRelationship: CustomerRelationship };

export const customerRelationshipCreated = makeAppEvent<CustomerRelationshipCreatedPayload>({
  cb: [
    ({ customerRelationship }) =>
      enqueueSegmentReconcileForCustomers([
        customerSideOfRow(
          { model: 'CustomerRelationship', axis: 'customerModel' },
          customerRelationship,
        ),
      ]),
  ],
});
