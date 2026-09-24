/**
 * @atlas
 * @kind schema
 * @partOf infrastructure:prisma, primitive:websockets
 * @uses feature:contact
 */
import { ContactScalarSchema } from '@template/db/generated/zod/scalarSchemas.gen';
import { defineStream, jsonWireSchema, listStreamSchemas } from '@template/shared/ws';
import { z } from 'zod';

// Scaffolding: the example stream, to be removed once a real stream consumer lands.
export const organizationContactsStream = defineStream('organizationReadManyContacts', {
  audience: 'shared',
  params: z.object({ id: z.string() }),
  ...listStreamSchemas(jsonWireSchema(ContactScalarSchema)),
});
