import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const spaceReadManyTokenRoute = readRoute({
  model: Modules.space,
  submodel: Modules.token,
  many: true,
  paginate: true,
  responseSchema: tokenReadResponseSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.token],
});
