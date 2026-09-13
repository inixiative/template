/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { CustomerModel } from '@template/db/generated/client/enums';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { refetch } from '#/appEvents/refetch';

export type CustomerRefSegmentsAddedPayload = {
  customerRefId: string;
  customerModel: CustomerModel;
  customerId: string;
  segmentIds: string[];
};

export const customerRefSegmentsAdded = makeAppEvent<CustomerRefSegmentsAddedPayload>({
  websocket: (data) =>
    data.customerModel === 'User'
      ? [
          {
            target: { userIds: [data.customerId] },
            message: { data: refetch({ _id: 'meReadManySegmentMemberships' }) },
          },
        ]
      : null,
});
