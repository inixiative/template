/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { artifactPlacementReadResponseSchema } from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const artifactPlacementDeleteRoute = deleteRoute({
  model: Modules.artifactPlacement,
  description:
    "Removes an artifact from a container (it is at its owner's root again if that was its last placement). Same-owner placements need manage on the artifact and operate on the container; cross-owner placements need operate on the container.",
  responseSchema: artifactPlacementReadResponseSchema,
  middleware: [validatePermission('delete')],
});
