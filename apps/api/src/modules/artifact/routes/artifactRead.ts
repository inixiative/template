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

export const artifactReadRoute = readRoute({
  model: Modules.artifact,
  responseSchema: artifactReadResponseSchema,
  middleware: [validateArtifactAccess('read')],
});
