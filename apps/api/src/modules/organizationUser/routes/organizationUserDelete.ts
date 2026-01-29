import { deleteRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserDeleteRoute = deleteRoute({
  model: Modules.organizationUser,
});
