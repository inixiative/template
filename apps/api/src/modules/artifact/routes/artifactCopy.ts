/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import {
  artifactCopyBodySchema,
  artifactReadResponseSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactCopyRoute = actionRoute({
  model: Modules.artifact,
  action: 'copy',
  description:
    "Copies an artifact into a container: a new artifact owned by the container's owner, inheriting there. Needs read on the source and operate on the container. A file copy shares the source's bytes until the sweeper copies them (lazy copy); a container is copied without its contents.",
  bodySchema: artifactCopyBodySchema,
  responseSchema: artifactReadResponseSchema,
});
