import { createRoute } from '#/lib/requestTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenCreateBodySchema, tokenCreateResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const organizationUserCreateTokenRoute = createRoute({
  model: Modules.organizationUser,
  submodel: Modules.token,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  middleware: [validateNotToken],
  tags: [Tags.Token],
});
