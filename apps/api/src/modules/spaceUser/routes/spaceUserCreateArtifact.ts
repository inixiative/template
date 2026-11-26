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

export const spaceUserCreateArtifactRoute = createRoute({
  model: Modules.spaceUser,
  submodel: Modules.artifact,
  middleware: [validateSubmodelPermission('create')],
  description:
    'Creates a member-owned artifact inside a space (private to the member, with space/org-owner break-glass).',
  bodySchema: artifactCreateBodySchema,
  responseSchema: artifactReadResponseSchema,
});
