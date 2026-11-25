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

export const organizationUserReadManyArtifactsRoute = readRoute({
  model: Modules.organizationUser,
  submodel: Modules.artifact,
  many: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  description:
    "Lists a member's non-root artifacts inside an organization that the caller can read (public, tenant, granted, or all for the member/org owner).",
  responseSchema: artifactWithPermissionsSchema,
});
