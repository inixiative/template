/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import { customerRelationshipSegmentMembershipRefetchHandoffs } from '#/appEvents/handlers/customerRelationship/customerRelationshipSegmentMembershipRefetchHandoffs';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import type { CustomerReference } from '#/modules/customerRelationship/lib/customerReference';

export type CustomerRelationshipSegmentsRemovedPayload = CustomerReference & {
  customerRelationshipId: string;
  segmentIds: string[];
};

export const customerRelationshipSegmentsRemoved =
  makeAppEvent<CustomerRelationshipSegmentsRemovedPayload>({
    websocket: customerRelationshipSegmentMembershipRefetchHandoffs,
  });
