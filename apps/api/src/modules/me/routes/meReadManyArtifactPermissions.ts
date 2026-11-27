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
import { OpenApiTags } from '#/modules/openApiTags';

export const meReadManyArtifactPermissionsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.artifactPermission,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: artifactPermissionListFilterLens,
  description:
    'Lists active artifact permissions granted to the acting user (including via customer relationships), with each shared artifact inline ("Shared with me").',
  responseSchema: artifactPermissionSharedResponseSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifactPermission],
});
