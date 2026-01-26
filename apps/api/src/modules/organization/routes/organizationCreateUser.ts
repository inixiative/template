import { z } from '@hono/zod-openapi';
import { OrganizationUserScalarSchema } from '@template/db';
import { createRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['viewer', 'member', 'admin', 'owner']).default('member'),
});

export const organizationCreateUserRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.organizationUser,
  bodySchema,
  responseSchema: OrganizationUserScalarSchema,
});
