import { ContactScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';

export const contactReadRoute = readRoute({
  model: Modules.contact,
  middleware: [validateOwnerPermission({ action: 'read' })],
  responseSchema: ContactScalarSchema,
});
