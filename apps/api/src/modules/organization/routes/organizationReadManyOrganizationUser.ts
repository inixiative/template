import { OrganizationUserScalarSchema, UserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/requestTemplates';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = OrganizationUserScalarSchema.extend({
  user: UserScalarSchema,
});

export const organizationReadManyOrganizationUserRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.organizationUser,
  many: true,
  paginate: true,
  responseSchema,
  tags: [Tags.Organization, Tags.OrganizationUser],
  middleware: [validateOrgPermission('read')],
});
