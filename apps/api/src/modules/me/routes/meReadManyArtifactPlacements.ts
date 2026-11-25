/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactPlacementListFilterLens,
  artifactPlacementWithArtifactsSchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meReadManyArtifactPlacementsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.artifactPlacement,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: artifactPlacementListFilterLens,
  middleware: [validatePermission('read')],
  description:
    "Lists artifact placements in the acting user's workspace (both root pins and container placements), with artifact and containerArtifact inline.",
  responseSchema: artifactPlacementWithArtifactsSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifactPlacement],
});
