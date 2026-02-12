import { OrganizationScalarSchema, OrganizationUserScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { validateUser } from '#/middleware/validations/validateUser';
import { Modules } from '#/modules/modules';

const responseSchema = OrganizationScalarSchema.extend({
  organizationUser: OrganizationUserScalarSchema,
});

export const organizationCreateRoute = createRoute({
  model: Modules.organization,
  bodySchema: OrganizationScalarSchema.pick({ name: true, slug: true }),
  responseSchema,
  middleware: [validateUser],
});
