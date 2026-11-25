/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
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
  description:
    "Lists the space's non-root artifacts that the caller can read (public, tenant, granted, or all for managers), with permissions for managers.",
  responseSchema: artifactWithPermissionsSchema,
});
