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

export const organizationReadManyArtifactsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.artifact,
  many: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  description:
    "Lists the organization's artifacts (defaults to root artifacts when no search/filter is passed) that the caller can read (public, tenant, granted, or all for managers), with permissions for managers.",
  responseSchema: artifactWithPermissionsSchema,
});
