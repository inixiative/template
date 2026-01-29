import { OrganizationUserScalarSchema, UserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = UserScalarSchema.extend({
  organizationUser: OrganizationUserScalarSchema,
});

export const organizationReadManyUsersRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.user,
  many: true,
  paginate: true,
  responseSchema,
  middleware: [validateOrgPermission('read')],
  tags: [Tags.user, Tags.organizationUser],
});
