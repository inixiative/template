/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactPlacementReadResponseSchema,
  artifactRootPlacementCreateBodySchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const spaceUserCreateArtifactPlacementRoute = createRoute({
  model: Modules.spaceUser,
  submodel: Modules.artifactPlacement,
  middleware: [validatePermission('operate')],
  description:
    "Pins an external readable artifact at the member's space workspace root (containerArtifactId = null).",
  bodySchema: artifactRootPlacementCreateBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
});
