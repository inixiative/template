/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactDeleteRoute = deleteRoute({
  model: Modules.artifact,
  description:
    'Deletes an artifact. Deleting a container deletes the container only, never its contents: they stay, and anything left in no container becomes private. To delete contents too, list them with GET /artifact/:id/exclusiveContents and delete them through /v1/batch. Deleting always needs own on the artifact.',
  responseSchema: artifactReadResponseSchema,
  middleware: [validateArtifactAccess('own')],
});
