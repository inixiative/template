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

export const organizationCreateArtifactPlacementRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.artifactPlacement,
  middleware: [validatePermission('manage')],
  description:
    "Pins an external readable artifact at the organization's root (containerArtifactId = null).",
  bodySchema: artifactRootPlacementCreateBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
});
