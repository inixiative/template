/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:jobs, primitive:websockets
 */
import type { Contact } from '@template/db/generated/client/client';
import { organizationContactUpsert } from '#/appEvents/handlers/contact/organizationContactsStream';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { customerSideOfRow } from '#/modules/customerRelationship/lib/customerRelationshipSides';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type ContactUpdatedPayload = { contact: Contact };

export const contactUpdated = makeAppEvent<ContactUpdatedPayload>({
  websocket: ({ contact }) => organizationContactUpsert(contact),
  cb: [
    ({ contact }) =>
      enqueueSegmentReconcileForCustomers([
        customerSideOfRow({ model: 'Contact', axis: 'ownerModel' }, contact),
      ]),
  ],
});
