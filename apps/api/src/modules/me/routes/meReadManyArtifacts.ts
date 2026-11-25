/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
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
  middleware: [validateSubmodelPermission('read')],
  description: "Lists the user's non-root artifacts with their permissions.",
  responseSchema: artifactWithPermissionsSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifact],
});
