import { OrganizationScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationUpdateRoute = updateRoute({
  model: Modules.organization,
  bodySchema: OrganizationScalarSchema.pick({ name: true, slug: true }).partial(),
  responseSchema: OrganizationScalarSchema,
  middleware: [validatePermission('manage')],
});
