import { OrganizationScalarSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { validateUser } from '#/middleware/validations/validateUser';
import { Modules } from '#/modules/modules';

export const organizationCreateRoute = createRoute({
  model: Modules.organization,
  bodySchema: OrganizationScalarSchema.pick({ name: true, slug: true }),
  responseSchema: OrganizationScalarSchema,
  middleware: [validateUser],
});
