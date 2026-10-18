/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import { artifactPermissionReadResponseSchema } from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadManyArtifactPermissionsRoute = readRoute({
  model: Modules.artifact,
  submodel: Modules.artifactPermission,
  many: true,
  description: 'Lists the grants made directly on an artifact.',
  responseSchema: artifactPermissionReadResponseSchema,
  middleware: [validateArtifactAccess('manage')],
});
