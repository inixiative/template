/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import {
  artifactPermissionListFilterLens,
  artifactPermissionSharedResponseSchema,
} from '#/modules/artifact/schemas/artifactPermissionSchemas';
import { Modules } from '#/modules/modules';

export const organizationReadManyArtifactPermissionsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.artifactPermission,
  many: true,
  paginate: true,
  filterLens: artifactPermissionListFilterLens,
  description:
    'Lists active artifact permissions granted to the organization (including via customer relationships), with each shared artifact inline.',
  responseSchema: artifactPermissionSharedResponseSchema,
});
