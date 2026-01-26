import { OrganizationScalarSchema, OrganizationUserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = OrganizationUserScalarSchema.extend({
  organization: OrganizationScalarSchema,
});

export const meReadManyOrganizationRoute = readRoute({
  model: Modules.me,
  submodel: Modules.organization,
  many: true,
  skipId: true,
  paginate: true,
  responseSchema,
  tags: [Tags.Organization],
});
