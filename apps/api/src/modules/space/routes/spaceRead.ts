import { SpaceScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const spaceReadRoute = readRoute({
  model: Modules.space,
  responseSchema: SpaceScalarSchema,
  // Public - no auth required
});
