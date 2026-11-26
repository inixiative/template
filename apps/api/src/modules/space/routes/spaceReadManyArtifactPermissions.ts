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

export const spaceReadManyArtifactPermissionsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.artifactPermission,
  many: true,
  paginate: true,
  filterLens: artifactPermissionListFilterLens,
  description:
    'Lists active artifact permissions granted to the space (including via customer relationships), with each shared artifact inline.',
  responseSchema: artifactPermissionSharedResponseSchema,
});
