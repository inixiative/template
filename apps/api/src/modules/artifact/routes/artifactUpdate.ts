/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactReadResponseSchema,
  artifactUpdateBodySchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactUpdateRoute = updateRoute({
  model: Modules.artifact,
  bodySchema: artifactUpdateBodySchema,
  responseSchema: artifactReadResponseSchema,
  middleware: [validatePermission('manage')],
});
