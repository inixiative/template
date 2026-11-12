/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { CustomerModel } from '@template/db/generated/client/enums';
import { customerSegmentsChanged } from '#/appEvents/handlers/customerRef/customerSegmentsChanged';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type CustomerRefSegmentsAddedPayload = {
  customerRefId: string;
  customerModel: CustomerModel;
  customerId: string;
  segmentIds: string[];
};

export const customerRefSegmentsAdded = makeAppEvent<CustomerRefSegmentsAddedPayload>({
  websocket: customerSegmentsChanged,
});
