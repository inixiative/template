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
    'Reads an artifact with its effective access, direct readable parents and children (1-step includes, with their permissions for managers), visible placements and bindings, and (for managers) direct and effective permissions.',
  responseSchema: artifactDetailResponseSchema,
  middleware: [validatePermission('read')],
});
