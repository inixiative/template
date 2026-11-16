/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import {
  artifactReadResponseSchema,
  artifactUpdateBodySchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactUpdateRoute = updateRoute({
  model: Modules.artifact,
  bodySchema: artifactUpdateBodySchema,
  responseSchema: artifactReadResponseSchema,
  middleware: [validateArtifactAccess('manage')],
});
