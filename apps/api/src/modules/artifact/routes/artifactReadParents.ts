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

export const artifactReadParentsRoute = readRoute({
  model: Modules.artifact,
  action: 'parents',
  description:
    'Lists the containers an artifact sits in directly, among those the caller can read.',
  responseSchema: z.array(artifactReadResponseSchema),
  middleware: [validatePermission('read')],
});
