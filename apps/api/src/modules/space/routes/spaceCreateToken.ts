import { createRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenCreateBodySchema, tokenCreateResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const spaceCreateTokenRoute = createRoute({
  model: Modules.space,
  submodel: Modules.token,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  middleware: [validatePermission('manage'), validateNotToken],
  tags: [Tags.token],
});
