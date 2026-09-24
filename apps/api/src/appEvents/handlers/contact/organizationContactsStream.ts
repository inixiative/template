/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:websockets
 */
import { ContactScalarSchema } from '@template/db';
import type { Contact } from '@template/db/generated/client/client';
import { organizationContactsStream } from '@template/db/streams';
import { toJsonWire } from '@template/shared/ws';
import { streamAppend } from '#/appEvents/streamAppend';
import type { WSHandoff } from '#/appEvents/types';

export const organizationContactUpsert = (contact: Contact): WSHandoff[] | null =>
  contact.organizationId
    ? [
        streamAppend(
          organizationContactsStream,
          { id: contact.organizationId },
          'upsert',
          toJsonWire(ContactScalarSchema.parse(contact)),
        ),
      ]
    : null;

export const organizationContactRemove = (contact: Contact): WSHandoff[] | null =>
  contact.organizationId
    ? [
        streamAppend(organizationContactsStream, { id: contact.organizationId }, 'remove', {
          id: contact.id,
          updatedAt: contact.updatedAt.toISOString(),
        }),
      ]
    : null;
