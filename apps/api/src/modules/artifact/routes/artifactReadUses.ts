/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { ResourceBindingScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validateArtifactAccess } from '#/middleware/validations/validateArtifactAccess';
import { artifactContainerReadResponseSchema } from '#/modules/artifact/schemas/artifactContainerSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadUsesRoute = readRoute({
  model: Modules.artifact,
  action: 'uses',
  description:
    "Where an artifact exists and where it is used: its placements (its owner's root, and the containers the caller can read) and its resource bindings (logo, avatar, ...).",
  responseSchema: z.object({
    placements: z.array(artifactContainerReadResponseSchema),
    bindings: z.array(ResourceBindingScalarSchema),
  }),
  middleware: [validateArtifactAccess('read')],
});
