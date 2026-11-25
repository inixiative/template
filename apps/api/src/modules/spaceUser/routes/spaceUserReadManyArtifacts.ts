/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import {
  artifactListFilterLens,
  artifactWithPermissionsSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const spaceUserReadManyArtifactsRoute = readRoute({
  model: Modules.spaceUser,
  submodel: Modules.artifact,
  many: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  description:
    "Lists a member's artifacts inside a space (defaults to root artifacts when no search/filter is passed) that the caller can read (public, tenant, granted, or all for the member/space owner).",
  responseSchema: artifactWithPermissionsSchema,
});
