import { OrganizationScalarSchema, OrganizationUserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = OrganizationScalarSchema.extend({
  organizationUser: OrganizationUserScalarSchema,
});

export const meReadManyOrganizationRoute = readRoute({
  model: Modules.me,
  submodel: Modules.organization,
  many: true,
  skipId: true,
  paginate: true,
  responseSchema,
  tags: [Tags.me, Tags.organization, Tags.organizationUser],
});
