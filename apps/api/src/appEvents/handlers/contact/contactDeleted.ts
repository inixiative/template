/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:jobs, primitive:websockets
 */
import type { Contact } from '@template/db/generated/client/client';
import { organizationContactRemove } from '#/appEvents/handlers/contact/organizationContactsStream';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { customerSideOfRow } from '#/modules/customerRelationship/lib/customerRelationshipSides';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type ContactDeletedPayload = { contact: Contact };

export const contactDeleted = makeAppEvent<ContactDeletedPayload>({
  websocket: ({ contact }) => organizationContactRemove(contact),
  cb: [
    ({ contact }) =>
      enqueueSegmentReconcileForCustomers([
        customerSideOfRow({ model: 'Contact', axis: 'ownerModel' }, contact),
      ]),
  ],
});
