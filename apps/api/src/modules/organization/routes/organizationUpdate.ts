import { OrganizationScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/requestTemplates';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';

export const organizationUpdateRoute = updateRoute({
  model: Modules.organization,
  bodySchema: OrganizationScalarSchema.pick({ name: true, slug: true }).partial(),
  responseSchema: OrganizationScalarSchema,
  middleware: [validateOrgPermission('manage')],
});
