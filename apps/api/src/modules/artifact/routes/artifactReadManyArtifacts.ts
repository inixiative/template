/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadManyArtifactsRoute = readRoute({
  model: Modules.artifact,
  submodel: Modules.artifact,
  many: true,
  description: 'Lists the artifacts directly inside a container that the caller can read.',
  responseSchema: artifactReadResponseSchema,
  middleware: [validateArtifactAccess('read')],
});
