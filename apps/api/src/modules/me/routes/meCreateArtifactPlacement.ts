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
import { OpenApiTags } from '#/modules/openApiTags';

export const meCreateArtifactPlacementRoute = createRoute({
  model: Modules.me,
  submodel: Modules.artifactPlacement,
  skipId: true,
  middleware: [validatePermission('operate')],
  description:
    "Pins an external readable artifact at the acting user's root (containerArtifactId = null).",
  bodySchema: artifactRootPlacementCreateBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifactPlacement],
});
