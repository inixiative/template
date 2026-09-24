/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:websockets
 */
import { ContactScalarSchema } from '@template/db';
import type { Contact } from '@template/db/generated/client/client';
import { type ListStreamAppend, WS_CHANNELS } from '@template/shared/ws';
import type { z } from 'zod';
import type { WSHandoff } from '#/appEvents/types';

export type OrganizationContactsAppend = ListStreamAppend<z.infer<typeof ContactScalarSchema>>;

export const organizationContactsHandoffs = (
  contact: Contact,
  append: OrganizationContactsAppend,
): WSHandoff[] | null => {
  if (!contact.organizationId) return null;
  return [
    {
      target: { streams: [WS_CHANNELS.organizationReadManyContacts.name(contact.organizationId)] },
      message: { data: append },
    },
  ];
};

export const contactUpsertAppend = (contact: Contact): OrganizationContactsAppend => ({
  upsert: ContactScalarSchema.parse(contact),
});
