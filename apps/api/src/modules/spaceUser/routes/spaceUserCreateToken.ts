import { createRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { Modules } from '#/modules/modules';
import { tokenCreateBodySchema, tokenCreateResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const spaceUserCreateTokenRoute = createRoute({
  model: Modules.spaceUser,
  submodel: Modules.token,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  middleware: [validateNotToken],
});
