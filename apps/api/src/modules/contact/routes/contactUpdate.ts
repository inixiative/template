import { ContactScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import {
  CONTACT_UPDATE_IMMUTABLE_FIELDS,
  contactUpdateBodySchema,
} from '#/modules/contact/schemas/contactSchemas';

export const contactUpdateRoute = updateRoute({
  model: Modules.contact,
  middleware: [validatePermission('manage')],
  bodySchema: contactUpdateBodySchema,
  sanitizeKeys: CONTACT_UPDATE_IMMUTABLE_FIELDS,
  responseSchema: ContactScalarSchema,
});
