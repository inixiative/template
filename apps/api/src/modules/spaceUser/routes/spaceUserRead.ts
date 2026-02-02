import { SpaceUserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const spaceUserReadRoute = readRoute({
  model: Modules.spaceUser,
  responseSchema: SpaceUserScalarSchema,
  middleware: [validatePermission('read')],
});
