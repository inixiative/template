import { deleteRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const spaceUserDeleteRoute = deleteRoute({
  model: Modules.spaceUser,
});
