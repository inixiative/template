/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  ARTIFACT_PERMISSION_IMMUTABLE_FIELDS,
  artifactPermissionFromVersionRefinement,
  artifactPermissionReadResponseSchema,
  artifactPermissionUpdateBodySchema,
} from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

export const artifactPermissionUpdateRoute = updateRoute({
  model: Modules.artifactPermission,
  bodySchema: artifactPermissionUpdateBodySchema,
  bodyRefinement: artifactPermissionFromVersionRefinement,
  sanitizeKeys: ARTIFACT_PERMISSION_IMMUTABLE_FIELDS,
  responseSchema: artifactPermissionReadResponseSchema,
  middleware: [validatePermission('manage')],
});
