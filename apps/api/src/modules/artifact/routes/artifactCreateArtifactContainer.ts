/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import {
  artifactContainerCreateBodySchema,
  artifactContainerReadResponseSchema,
} from '#/modules/artifact/schemas/artifactContainerSchemas';
import { Modules } from '#/modules/modules';

export const artifactCreateArtifactContainerRoute = createRoute({
  model: Modules.artifact,
  submodel: Modules.artifactContainer,
  description:
    'Places an artifact in a container. Needs manage on the artifact and operate on the container.',
  bodySchema: artifactContainerCreateBodySchema,
  responseSchema: artifactContainerReadResponseSchema,
});
