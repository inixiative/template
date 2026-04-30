import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  CONTACT_CREATE_IMMUTABLE_FIELDS,
  contactCreateBodySchema,
  contactReadResponseSchema,
} from '#/modules/contact/schemas/contactSchemas';
import { Modules } from '#/modules/modules';

export const organizationCreateContactRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.contact,
  bodySchema: contactCreateBodySchema,
  responseSchema: contactReadResponseSchema,
  middleware: [validatePermission('manage')],
  sanitizeKeys: CONTACT_CREATE_IMMUTABLE_FIELDS,
});
