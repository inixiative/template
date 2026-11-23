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
    'Deletes an artifact. Deleting a container deletes the container only, never its contents: they stay at root as access inherit with no ancestors. To delete contents too, list them with GET /artifact/:id/exclusiveContents and delete them through /v1/batch. Deleting needs own on the artifact, or organization/space owner break-glass on a member-owned artifact.',
  responseSchema: artifactReadResponseSchema,
  middleware: [validatePermission('delete')],
});
