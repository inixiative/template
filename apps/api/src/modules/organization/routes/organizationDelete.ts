import { deleteRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationDeleteRoute = deleteRoute({
  model: Modules.organization,
  middleware: [validateNotToken, validatePermission('own')],
});
