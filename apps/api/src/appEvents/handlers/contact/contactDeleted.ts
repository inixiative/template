/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:jobs, primitive:websockets
 */
import { resolveFalsePolymorphismRef } from '@template/db';
import type { Contact } from '@template/db/generated/client/client';
import { organizationContactRemove } from '#/appEvents/handlers/contact/organizationContactsStream';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';

export type ContactDeletedPayload = { contact: Contact };

export const contactDeleted = makeAppEvent<ContactDeletedPayload>({
  websocket: ({ contact }) => organizationContactRemove(contact),
  cb: [
    async ({ contact }) => {
      const fk = resolveFalsePolymorphismRef({ model: 'Contact', axis: 'ownerModel', value: contact.ownerModel })!;
      const customerId = (contact as unknown as Record<string, string | null>)[fk];
      if (!customerId) return;
      await enqueueJob('reconcileCustomerRefSegments', { customerModel: contact.ownerModel, customerId });
    },
  ],
});
