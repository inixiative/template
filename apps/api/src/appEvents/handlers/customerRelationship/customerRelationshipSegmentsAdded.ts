/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import { customerRelationshipSegmentMembershipRefetchHandoffs } from '#/appEvents/handlers/customerRelationship/customerRelationshipSegmentMembershipRefetchHandoffs';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import type { CustomerSide } from '#/modules/customerRelationship/lib/customerRelationshipSides';

export type CustomerRelationshipSegmentsAddedPayload = CustomerSide & {
  customerRelationshipId: string;
  segmentIds: string[];
};

export const customerRelationshipSegmentsAdded =
  makeAppEvent<CustomerRelationshipSegmentsAddedPayload>({
    websocket: customerRelationshipSegmentMembershipRefetchHandoffs,
  });
