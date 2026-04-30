import { ContactScalarSchema } from '@template/db';
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const contactDeleteRoute = deleteRoute({
  model: Modules.contact,
  middleware: [validatePermission('manage')],
  responseSchema: ContactScalarSchema,
});
