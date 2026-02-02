import { z } from '@hono/zod-openapi';
import { SpaceScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminSpaceReadManyRoute = readRoute({
  model: Modules.space,
  many: true,
  paginate: true,
  admin: true,
  query: z.object({
    search: z.string().optional(),
    deleted: z.enum(['true', 'false', 'all']).default('false'),
    organizationId: z.string().optional(),
  }),
  responseSchema: SpaceScalarSchema,
});
