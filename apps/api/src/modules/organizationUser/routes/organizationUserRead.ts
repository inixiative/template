import { OrganizationUserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationUserReadRoute = readRoute({
  model: Modules.organizationUser,
  responseSchema: OrganizationUserScalarSchema,
  middleware: [validatePermission('read')],
});
