/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import {
  artifactListFilterLens,
  artifactWithPermissionsSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const userReadManyArtifactsRoute = readRoute({
  model: Modules.user,
  submodel: Modules.artifact,
  many: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  description:
    "Lists the user's non-root artifacts that the caller can read (public, granted, or all for the user themselves), with permissions for managers.",
  responseSchema: artifactWithPermissionsSchema,
});
