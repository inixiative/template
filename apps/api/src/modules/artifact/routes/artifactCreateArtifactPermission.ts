/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute, polymorphicBodyRefinement } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactPermissionCreateBodySchema,
  artifactPermissionFromVersionRefinement,
  artifactPermissionReadResponseSchema,
} from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

const granteeRefinement = polymorphicBodyRefinement('ArtifactPermission', 'granteeModel');

export const artifactCreateArtifactPermissionRoute = createRoute({
  model: Modules.artifact,
  submodel: Modules.artifactPermission,
  description: 'Grants a role on an artifact, and through inherit on everything inside it.',
  bodySchema: artifactPermissionCreateBodySchema,
  bodyRefinement: (body, ctx) => {
    granteeRefinement(body as Record<string, unknown>, ctx);
    artifactPermissionFromVersionRefinement(body, ctx);
  },
  responseSchema: artifactPermissionReadResponseSchema,
  middleware: [validatePermission('manage')],
});
