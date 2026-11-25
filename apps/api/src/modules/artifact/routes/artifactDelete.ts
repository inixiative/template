/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactDeleteRoute = deleteRoute({
  model: Modules.artifact,
  description:
    "Deletes an artifact (root containers cannot be deleted). Deleting a container deletes the container only, never its contents: exclusive same-owner children are reparented to the owner's root as private. To delete exclusive contents too, read them from GET /artifact/:id (artifactPlacementsAsContainer[].artifact with exclusive=true) and delete them through /v1/batch. Deleting needs own on the artifact, or organization/space owner break-glass on a member-owned artifact.",
  responseSchema: artifactReadResponseSchema,
  middleware: [validatePermission('delete')],
});
