import { OrganizationScalarSchema } from '@template/db';
import { readRoute } from '#/lib/requestTemplates';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';

export const organizationReadRoute = readRoute({
  model: Modules.organization,
  responseSchema: OrganizationScalarSchema,
  middleware: [validateOrgPermission('read')],
});
