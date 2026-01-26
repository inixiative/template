import { deleteRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserDeleteRoute = deleteRoute({
  model: Modules.organizationUser,
});
