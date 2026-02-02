import { OrganizationScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationReadProtectedRoute = readRoute({
  model: Modules.organization,
  action: 'protected',
  responseSchema: OrganizationScalarSchema,
  middleware: [validatePermission('read')],
});
