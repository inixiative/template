/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const organizationReadManyArtifactsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.artifact,
  many: true,
  middleware: [validatePermission('read')],
  description:
    "Lists the owner's root artifacts (those in no container) that the caller can read: the top of the browser.",
  responseSchema: artifactReadResponseSchema,
});
