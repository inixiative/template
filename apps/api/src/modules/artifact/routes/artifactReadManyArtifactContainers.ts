/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import { artifactContainerReadResponseSchema } from '#/modules/artifact/schemas/artifactContainerSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadManyArtifactContainersRoute = readRoute({
  model: Modules.artifact,
  submodel: Modules.artifactContainer,
  many: true,
  description: 'Lists the container edges an artifact sits in.',
  responseSchema: artifactContainerReadResponseSchema,
  middleware: [validateArtifactAccess('read')],
});
