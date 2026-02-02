import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const spaceDeleteRoute = deleteRoute({
  model: Modules.space,
  middleware: [validatePermission('own')],
});
