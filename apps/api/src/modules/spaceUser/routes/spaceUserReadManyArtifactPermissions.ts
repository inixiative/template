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

export const spaceUserReadManyArtifactPermissionsRoute = readRoute({
  model: Modules.spaceUser,
  submodel: Modules.artifactPermission,
  many: true,
  paginate: true,
  filterLens: artifactPermissionListFilterLens,
  middleware: [validatePermission('operate')],
  description:
    'Lists active artifact permissions granted to this space member seat, with each shared artifact inline.',
  responseSchema: artifactPermissionSharedResponseSchema,
});
