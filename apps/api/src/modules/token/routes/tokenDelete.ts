import { deleteRoute } from '#/lib/requestTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { Modules } from '#/modules/modules';

export const tokenDeleteRoute = deleteRoute({
  model: Modules.token,
  middleware: [validateNotToken],
});
