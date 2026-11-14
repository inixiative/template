/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import {
  artifactPermissionCreateBodySchema,
  artifactPermissionReadResponseSchema,
} from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

export const artifactCreateArtifactPermissionRoute = createRoute({
  model: Modules.artifact,
  submodel: Modules.artifactPermission,
  description: 'Grants a role on an artifact, and through inherit on everything inside it.',
  bodySchema: artifactPermissionCreateBodySchema,
  responseSchema: artifactPermissionReadResponseSchema,
  middleware: [validateArtifactAccess('manage')],
});
