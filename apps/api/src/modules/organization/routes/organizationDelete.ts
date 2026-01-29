import { deleteRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';

export const organizationDeleteRoute = deleteRoute({
  model: Modules.organization,
  middleware: [validateNotToken, validateOrgPermission('own')],
});
