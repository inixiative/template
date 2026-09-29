/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:jobs, primitive:websockets
 */
import { resolveFalsePolymorphismRef } from '@template/db';
import type { Contact } from '@template/db/generated/client/client';
import { organizationContactUpsert } from '#/appEvents/handlers/contact/organizationContactsStream';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { enqueueJob } from '#/jobs/enqueue';

export type ContactUpdatedPayload = { contact: Contact };

export const contactUpdated = makeAppEvent<ContactUpdatedPayload>({
  websocket: ({ contact }) => organizationContactUpsert(contact),
  cb: [
    async ({ contact }) => {
      const fk = resolveFalsePolymorphismRef({ model: 'Contact', axis: 'ownerModel', value: contact.ownerModel })!;
      const customerId = (contact as unknown as Record<string, string | null>)[fk];
      if (!customerId) return;
      await enqueueJob('reconcileCustomerRefSegments', { customerModel: contact.ownerModel, customerId });
    },
  ],
});
