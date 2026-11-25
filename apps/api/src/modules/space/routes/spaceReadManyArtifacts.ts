/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactListFilterLens,
  artifactWithPermissionsSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const spaceReadManyArtifactsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.artifact,
  many: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  middleware: [validatePermission('read')],
  description:
    "Lists the space's artifacts (defaults to root artifacts when no search/filter is passed) that the caller can read, with permissions for managers.",
  responseSchema: artifactWithPermissionsSchema,
});
