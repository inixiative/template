/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import {
  artifactCreateBodySchema,
  artifactReadResponseSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const organizationUserCreateArtifactRoute = createRoute({
  model: Modules.organizationUser,
  submodel: Modules.artifact,
  middleware: [validateSubmodelPermission('create')],
  description:
    'Creates a member-owned artifact inside an organization (private to the member, with org-owner break-glass).',
  bodySchema: artifactCreateBodySchema,
  responseSchema: artifactReadResponseSchema,
});
