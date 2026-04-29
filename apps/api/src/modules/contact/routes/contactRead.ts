import { ContactScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const contactReadRoute = readRoute({
  model: Modules.contact,
  middleware: [validatePermission('read')],
  responseSchema: ContactScalarSchema,
});
