/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import { artifactPermissionReadResponseSchema } from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

export const artifactPermissionDeleteRoute = deleteRoute({
  model: Modules.artifactPermission,
  responseSchema: artifactPermissionReadResponseSchema,
  middleware: [validateArtifactAccess('manage')],
});
