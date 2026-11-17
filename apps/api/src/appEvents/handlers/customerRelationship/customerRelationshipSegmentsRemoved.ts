/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { CustomerModel } from '@template/db/generated/client/enums';
import { customerSegmentsChanged } from '#/appEvents/handlers/customerRelationship/customerSegmentsChanged';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type CustomerRelationshipSegmentsRemovedPayload = {
  customerRelationshipId: string;
  customerModel: CustomerModel;
  customerId: string;
  segmentIds: string[];
};

export const customerRelationshipSegmentsRemoved =
  makeAppEvent<CustomerRelationshipSegmentsRemovedPayload>({
    websocket: customerSegmentsChanged,
  });
