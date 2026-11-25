/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactPlacementReadResponseSchema,
  artifactPlacementUpdateBodySchema,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const artifactPlacementUpdateRoute = updateRoute({
  model: Modules.artifactPlacement,
  description:
    'Updates visibility (access) on an artifact placement. Needs manage on the container (and manage on the artifact when same-owner). Root placements cannot use inherit.',
  bodySchema: artifactPlacementUpdateBodySchema,
  responseSchema: artifactPlacementReadResponseSchema,
  middleware: [validatePermission('manage')],
});
