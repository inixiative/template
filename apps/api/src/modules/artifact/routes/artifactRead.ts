/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { artifactDetailResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadRoute = readRoute({
  model: Modules.artifact,
  description:
    'Reads an artifact with its materialized effectiveAccess and effectiveRole, accessible artifactPlacementsAsArtifact (with containerArtifact and artifactPermissions for managers) and artifactPlacementsAsContainer (with child artifact, exclusive, and artifactPermissions for managers), visible resourceBindings, and (for managers) artifactPermissions and artifactEffectivePermissions.',
  responseSchema: artifactDetailResponseSchema,
  middleware: [validatePermission('read')],
});
