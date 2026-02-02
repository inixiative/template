import { SpaceScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const spaceReadProtectedRoute = readRoute({
  model: Modules.space,
  action: 'protected',
  responseSchema: SpaceScalarSchema,
  middleware: [validatePermission('read')],
});
