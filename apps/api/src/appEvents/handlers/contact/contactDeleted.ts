/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:jobs, primitive:websockets
 */
import { polymorphicKeyColumn } from '@template/db';
import type { Contact } from '@template/db/generated/client/client';
import { organizationContactRemove } from '#/appEvents/handlers/contact/organizationContactsStream';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type ContactDeletedPayload = { contact: Contact };

export const contactDeleted = makeAppEvent<ContactDeletedPayload>({
  websocket: ({ contact }) => organizationContactRemove(contact),
  cb: [
    async ({ contact }) => {
      const fk = polymorphicKeyColumn('Contact', 'ownerModel', contact.ownerModel)!;
      const customerId = (contact as unknown as Record<string, string | null>)[fk];
      if (!customerId) return;
      await enqueueSegmentReconcileForCustomers([
        {
          customerModel: contact.ownerModel,
          customerId,
        },
      ]);
    },
  ],
});
