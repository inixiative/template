/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { CustomerRelationship } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { reconcileCustomerOf } from '#/modules/segment/lib/reconcileCustomer';

export type CustomerRelationshipCreatedPayload = { customerRelationship: CustomerRelationship };

export const customerRelationshipCreated = makeAppEvent<CustomerRelationshipCreatedPayload>({
  cb: [
    ({ customerRelationship }) =>
      reconcileCustomerOf(
        { model: 'CustomerRelationship', axis: 'customerModel' },
        customerRelationship,
      ),
  ],
});
