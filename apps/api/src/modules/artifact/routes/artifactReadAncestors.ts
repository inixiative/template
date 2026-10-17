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

export const artifactReadAncestorsRoute = readRoute({
  model: Modules.artifact,
  action: 'ancestors',
  description:
    'Returns the containers above an artifact up to its roots, as a graph: each shared ancestor once, the edges between them, depth-capped like the access walk, and only containers the caller can read.',
  responseSchema: z.object({
    artifacts: z.array(artifactReadResponseSchema),
    edges: z.array(z.object({ artifactId: z.string(), containerArtifactId: z.string() })),
  }),
  middleware: [validateArtifactAccess('read')],
});
