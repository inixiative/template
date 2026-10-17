/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { artifactContainerReadResponseSchema } from '#/modules/artifact/schemas/artifactContainerSchemas';
import { Modules } from '#/modules/modules';

export const artifactContainerDeleteRoute = deleteRoute({
  model: Modules.artifactContainer,
  description:
    'Removes an artifact from a container. Needs manage on the artifact and operate on the container.',
  responseSchema: artifactContainerReadResponseSchema,
});
