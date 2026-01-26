import { createRoute } from '#/lib/requestTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenCreateBodySchema, tokenCreateResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const meCreateTokenRoute = createRoute({
  model: Modules.me,
  submodel: Modules.token,
  skipId: true,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  middleware: [validateNotToken],
  tags: [Tags.Token],
});
