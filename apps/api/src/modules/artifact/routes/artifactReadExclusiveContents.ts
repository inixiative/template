/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { readRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadExclusiveContentsRoute = readRoute({
  model: Modules.artifact,
  action: 'exclusiveContents',
  description:
    'Lists the artifacts that sit directly in this container and in no other container, among those the caller can read. Deleting the container keeps them; to delete them as well, send their deletes through /v1/batch.',
  responseSchema: z.array(artifactReadResponseSchema),
  middleware: [validateArtifactAccess('read')],
});
