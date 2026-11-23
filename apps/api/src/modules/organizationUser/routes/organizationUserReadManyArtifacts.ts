/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const organizationUserReadManyArtifactsRoute = readRoute({
  model: Modules.organizationUser,
  submodel: Modules.artifact,
  many: true,
  middleware: [validateSubmodelPermission('read')],
  description: "Lists a member's root artifacts inside an organization.",
  responseSchema: artifactReadResponseSchema,
});
