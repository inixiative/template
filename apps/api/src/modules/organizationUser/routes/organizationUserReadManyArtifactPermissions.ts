/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactPermissionListFilterLens,
  artifactPermissionSharedResponseSchema,
} from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

export const organizationUserReadManyArtifactPermissionsRoute = readRoute({
  model: Modules.organizationUser,
  submodel: Modules.artifactPermission,
  many: true,
  paginate: true,
  filterLens: artifactPermissionListFilterLens,
  middleware: [validatePermission('operate')],
  description:
    'Lists active artifact permissions granted to this organization member seat, with each shared artifact inline.',
  responseSchema: artifactPermissionSharedResponseSchema,
});
