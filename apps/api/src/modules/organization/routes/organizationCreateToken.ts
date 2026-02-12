import { createRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { tokenCreateBodySchema, tokenCreateResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const organizationCreateTokenRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.token,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  middleware: [validatePermission('operate'), validateNotToken],
});
