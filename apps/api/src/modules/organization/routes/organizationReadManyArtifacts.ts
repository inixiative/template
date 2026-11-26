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

export const organizationReadManyArtifactsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.artifact,
  many: true,
  paginate: true,
  filterLens: artifactListFilterLens,
  description:
    "Lists the organization's non-root artifacts that the caller can read (public, tenant, granted, or all for managers), with permissions for managers.",
  responseSchema: artifactWithPermissionsSchema,
});
