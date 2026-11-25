/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
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
  middleware: [validatePermission('read')],
  description:
    'Lists active artifact permissions granted to the acting user (including via customer relationships), with each shared artifact inline ("Shared with me").',
  responseSchema: artifactPermissionSharedResponseSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifactPermission],
});
