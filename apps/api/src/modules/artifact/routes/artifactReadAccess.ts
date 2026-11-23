/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { artifactAccessResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadAccessRoute = readRoute({
  model: Modules.artifact,
  action: 'access',
  description: "Resolves the caller's role on an artifact and whether it is public.",
  responseSchema: artifactAccessResponseSchema,
  middleware: [validatePermission('read')],
});
