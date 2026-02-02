import { SpaceUserScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const spaceUserUpdateRoute = updateRoute({
  model: Modules.spaceUser,
  bodySchema: SpaceUserScalarSchema.pick({ role: true }).partial(),
  responseSchema: SpaceUserScalarSchema,
});
