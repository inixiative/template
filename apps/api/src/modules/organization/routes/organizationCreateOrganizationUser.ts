import { z } from '@hono/zod-openapi';
import { OrganizationUserScalarSchema, UserScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const bodySchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(['viewer', 'member', 'admin', 'owner']).default('member'),
});

const responseSchema = OrganizationUserScalarSchema.extend({
  user: UserScalarSchema,
});

export const organizationCreateOrganizationUserRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.organizationUser,
  bodySchema,
  responseSchema,
  tags: [Tags.organizationUser, Tags.user],
});
