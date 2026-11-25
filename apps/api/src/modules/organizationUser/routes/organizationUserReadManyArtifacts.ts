/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import {
  artifactListFilterLens,
  artifactWithPermissionsSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const organizationUserReadManyArtifactsRoute = readRoute({
  model: Modules.organizationUser,
  submodel: Modules.artifact,
  many: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  middleware: [validateSubmodelPermission('read')],
  description:
    "Lists a member's artifacts inside an organization (defaults to root artifacts when no search/filter is passed).",
  responseSchema: artifactWithPermissionsSchema,
});
