/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  artifactCopyBodyRefinement,
  artifactCopyBodySchema,
  artifactReadResponseSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactCopyRoute = actionRoute({
  model: Modules.artifact,
  action: 'copy',
  description:
    "Copies an artifact into a target container (targetContainerArtifactId) or owner root (ownerModel + owner keys, or omit both for the caller's personal root): a new artifact owned by the target container's owner, using that container's default placement access. Needs read on the source and operate on the target container. A file copy shares the source's bytes until swept (lazy copy, FEAT-030); a container is copied without its contents.",
  bodySchema: artifactCopyBodySchema,
  bodyRefinement: artifactCopyBodyRefinement,
  responseSchema: artifactReadResponseSchema,
  middleware: [validatePermission('read')],
});
