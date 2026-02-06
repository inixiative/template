import { z } from '@hono/zod-openapi';
import { OrganizationScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminOrganizationReadManyRoute = readRoute({
  model: Modules.organization,
  many: true,
  paginate: true,
  admin: true,
  query: z.object({
    deleted: z.enum(['true', 'false', 'all']).default('false'),
  }),
  responseSchema: OrganizationScalarSchema,
  searchableFields: ['name', 'slug'],
});
