import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import {
  contactCreateBodySchema,
  contactReadResponseSchema,
} from '#/modules/contact/schemas/contactSchemas';

export const organizationCreateContactRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.contact,
  bodySchema: contactCreateBodySchema,
  responseSchema: contactReadResponseSchema,
  middleware: [validatePermission('manage')],
});
