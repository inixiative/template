import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const organizationReadManyTokensRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.token,
  many: true,
  paginate: true,
  responseSchema: tokenReadResponseSchema,
  middleware: [validatePermission('operate')],
});
