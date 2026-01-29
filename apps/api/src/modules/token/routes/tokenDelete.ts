import { deleteRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';

export const tokenDeleteRoute = deleteRoute({
  model: Modules.token,
  middleware: [validateNotToken, validateOwnerPermission({ action: 'manage' })],
});
