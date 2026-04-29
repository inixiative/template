import { ContactScalarSchema } from '@template/db';
import { deleteRoute } from '#/lib/routeTemplates';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';

export const contactDeleteRoute = deleteRoute({
  model: Modules.contact,
  middleware: [validateOwnerPermission({ action: 'manage' })],
  responseSchema: ContactScalarSchema,
});
