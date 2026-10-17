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
    "Removes an artifact from a container. A placement in the artifact's own owner's container needs manage on the artifact and operate on the container; a placement in another owner's container can be removed by either side (operate on the container, or manage on the artifact). The owner-root placement can't be removed.",
  responseSchema: artifactContainerReadResponseSchema,
});
