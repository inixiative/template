/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactPlacementMoveBodySchema,
  artifactPlacementReadResponseSchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const artifactPlacementMoveRoute = actionRoute({
  model: Modules.artifactPlacement,
  action: 'move',
  description:
    "Moves an artifact placement to another container owned by the same owner (omit targetContainerArtifactId to move to that owner's root). Refuses cross-owner moves; create a new placement instead.",
  bodySchema: artifactPlacementMoveBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
  middleware: [validatePermission('delete')],
});
