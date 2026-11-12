/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses feature:contact, primitive:websockets
 */
import type { Contact } from '@template/db/generated/client/client';
import { STREAM_DEFINITIONS } from '@template/shared/ws';
import { routeRow } from '#/appEvents/routeRow';
import { streamAppend } from '#/appEvents/streamAppend';
import type { WSHandoff } from '#/appEvents/types';
import { organizationReadManyContactsRoute } from '#/modules/organization/routes/organizationReadManyContacts';

const stream = STREAM_DEFINITIONS.organizationReadManyContacts;

export const organizationContactUpsert = (contact: Contact): WSHandoff[] | null =>
  contact.organizationId
    ? [
        streamAppend(
          stream,
          { id: contact.organizationId },
          'upsert',
          routeRow(organizationReadManyContactsRoute, contact),
        ),
      ]
    : null;

export const organizationContactRemove = (contact: Contact): WSHandoff[] | null =>
  contact.organizationId
    ? [streamAppend(stream, { id: contact.organizationId }, 'remove', { id: contact.id })]
    : null;
