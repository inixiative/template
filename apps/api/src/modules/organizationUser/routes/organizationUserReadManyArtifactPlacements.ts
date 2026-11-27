/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import {
  artifactPlacementListFilterLens,
  artifactPlacementWithArtifactsSchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const organizationUserReadManyArtifactPlacementsRoute = readRoute({
  model: Modules.organizationUser,
  submodel: Modules.artifactPlacement,
  many: true,
  paginate: true,
  filterLens: artifactPlacementListFilterLens,
  description:
    "Lists readable artifact placements in the member's organization workspace (defaults to root placements, including public and tenant reshares), with artifact and containerArtifact inline.",
  responseSchema: artifactPlacementWithArtifactsSchema,
});
