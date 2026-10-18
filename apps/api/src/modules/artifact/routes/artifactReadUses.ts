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
import { artifactPlacementReadResponseSchema } from '#/modules/artifact/schemas/artifactPlacementSchemas';
import { Modules } from '#/modules/modules';

export const artifactReadUsesRoute = readRoute({
  model: Modules.artifact,
  action: 'uses',
  description:
    'Where an artifact exists and where it is used, as the caller sees it: its owner, who has access, its placements in containers the caller can read, and the resource bindings (logo, avatar, tracking) on resources the caller can read.',
  responseSchema: z.object({
    owner: z.object({ ownerModel: z.string(), ownerId: z.string() }),
    access: z.object({
      public: z.boolean(),
      grants: z.array(
        z.object({
          principal: z.object({ kind: z.string(), ids: z.array(z.string()) }),
          role: z.string(),
        }),
      ),
    }),
    placements: z.array(artifactPlacementReadResponseSchema),
    bindings: z.array(ResourceBindingScalarSchema),
  }),
  middleware: [validateArtifactAccess('read')],
});
