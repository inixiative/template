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
    "Removes an artifact from a container (reparenting an owned artifact to its owner's lazy root as private if removed from its last non-root folder; refuses removing a root placement if it is the artifact's only same-owner placement).",
  responseSchema: artifactPlacementReadResponseSchema,
  middleware: [validatePermission('delete')],
});
