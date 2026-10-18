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
    'Places an artifact in a container. Needs manage on the artifact and operate on the container.',
  bodySchema: artifactPlacementCreateBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
});
