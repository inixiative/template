/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { SpaceUserScalarInputSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { spaceUserReadResponseSchema } from '#/modules/spaceUser/schemas/spaceUserSchemas';

export const spaceUserUpdateRoute = updateRoute({
  model: Modules.spaceUser,
  bodySchema: SpaceUserScalarInputSchema.pick({ role: true }).partial(),
  responseSchema: spaceUserReadResponseSchema,
});
