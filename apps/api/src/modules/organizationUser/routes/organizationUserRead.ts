import { OrganizationUserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/requestTemplates';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';

export const organizationUserReadRoute = readRoute({
  model: Modules.organizationUser,
  responseSchema: OrganizationUserScalarSchema,
  middleware: [validateOrgPermission('read')],
});
