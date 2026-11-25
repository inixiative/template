/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import {
  artifactPlacementCreateBodyRefinement,
  artifactPlacementCreateBodySchema,
  artifactPlacementReadResponseSchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const artifactCreateArtifactPlacementRoute = createRoute({
  model: Modules.artifact,
  submodel: Modules.artifactPlacement,
  description:
    "Places an artifact in a container (via containerArtifactId) or at an owner's lazy root (via ownerModel + owner keys). Root placements default to private; folder placements default to inherit.",
  bodySchema: artifactPlacementCreateBodySchema,
  bodyRefinement: artifactPlacementCreateBodyRefinement,
  responseSchema: artifactPlacementReadResponseSchema,
});
