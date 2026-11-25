/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactListFilterLens,
  artifactWithPermissionsSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meReadManyArtifactsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.artifact,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  middleware: [validatePermission('read')],
  description:
    "Lists the user's artifacts (defaults to root artifacts when no search/filter is passed) with their permissions.",
  responseSchema: artifactWithPermissionsSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifact],
});
