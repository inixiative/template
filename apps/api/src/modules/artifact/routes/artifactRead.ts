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
    'Reads an artifact with its materialized effectiveAccess and effectiveRole, direct readable parents (excluding root) and children (1-step includes with placementId, placementAccess, exclusive, and permissions for managers), visible placements and bindings, and (for managers) direct and effective permissions.',
  responseSchema: artifactDetailResponseSchema,
  middleware: [validatePermission('read')],
});
