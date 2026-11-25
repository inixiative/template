/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactPlacementReadResponseSchema,
  artifactRootPlacementCreateBodySchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const spaceCreateArtifactPlacementRoute = createRoute({
  model: Modules.space,
  submodel: Modules.artifactPlacement,
  middleware: [validatePermission('manage')],
  description:
    "Pins an external readable artifact at the space's root (containerArtifactId = null).",
  bodySchema: artifactRootPlacementCreateBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
});
