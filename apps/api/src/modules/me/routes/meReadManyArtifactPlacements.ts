/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
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
  description:
    "Lists artifact placements in the acting user's workspace (defaults to root placements, including owned items and external pins/reshares), with artifact and containerArtifact inline.",
  responseSchema: artifactPlacementWithArtifactsSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifactPlacement],
});
