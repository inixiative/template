/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { artifactPlacementReadResponseSchema } from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadManyArtifactPlacementsRoute = readRoute({
  model: Modules.artifact,
  submodel: Modules.artifactPlacement,
  many: true,
  description: 'Lists the container edges an artifact sits in.',
  responseSchema: artifactPlacementReadResponseSchema,
  middleware: [validatePermission('read')],
});
