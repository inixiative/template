/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import {
  artifactPlacementCreateBodySchema,
  artifactPlacementReadResponseSchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const artifactCreateArtifactPlacementRoute = createRoute({
  model: Modules.artifact,
  submodel: Modules.artifactPlacement,
  description:
    'Places an artifact in a container. Same-owner placements need manage on the artifact and operate on the container; cross-owner placements need read on the artifact and operate on the container and never inherit permissions.',
  bodySchema: artifactPlacementCreateBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
});
