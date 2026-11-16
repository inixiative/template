/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import {
  ARTIFACT_PERMISSION_IMMUTABLE_FIELDS,
  artifactPermissionReadResponseSchema,
  artifactPermissionUpdateBodySchema,
} from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

export const artifactPermissionUpdateRoute = updateRoute({
  model: Modules.artifactPermission,
  bodySchema: artifactPermissionUpdateBodySchema,
  sanitizeKeys: ARTIFACT_PERMISSION_IMMUTABLE_FIELDS,
  responseSchema: artifactPermissionReadResponseSchema,
  middleware: [validateArtifactAccess('manage')],
});
