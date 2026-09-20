/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { CustomerRef } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { reconcileCustomerOf } from '#/modules/segment/lib/reconcileCustomer';

export type CustomerRefCreatedPayload = { customerRef: CustomerRef };

export const customerRefCreated = makeAppEvent<CustomerRefCreatedPayload>({
  cb: [({ customerRef }) => reconcileCustomerOf({ model: 'CustomerRef', axis: 'customerModel' }, customerRef)],
});
