/**
 * @atlas
 * @kind route
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
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
    "Lists a member's non-root artifacts inside a space that the caller can read (public, tenant, granted, or all for the member/space owner).",
  responseSchema: artifactWithPermissionsSchema,
});
