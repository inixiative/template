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

export const userReadManyArtifactPlacementsRoute = readRoute({
  model: Modules.user,
  submodel: Modules.artifactPlacement,
  many: true,
  paginate: true,
  filterLens: artifactPlacementListFilterLens,
  description:
    "Lists readable artifact placements in the user's workspace (defaults to root placements, including public reshares), with artifact and containerArtifact inline.",
  responseSchema: artifactPlacementWithArtifactsSchema,
});
