/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadManyArtifactsRoute = readRoute({
  model: Modules.artifact,
  submodel: Modules.artifact,
  many: true,
  query: z.object({
    exclusive: z.enum(['true', 'false']).optional(),
  }),
  description:
    'Lists the artifacts directly inside a container that the caller can read. Pass exclusive=true to return only items that sit in no other container.',
  responseSchema: artifactReadResponseSchema,
  middleware: [validatePermission('read')],
});
