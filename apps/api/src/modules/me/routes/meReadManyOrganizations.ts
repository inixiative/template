import { OrganizationScalarSchema, OrganizationUserScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = OrganizationScalarSchema.extend({
  organizationUser: OrganizationUserScalarSchema,
});

export const meReadManyOrganizationsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.organization,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Organization') },
  responseSchema,
  tags: [Tags.me, Tags.organization, Tags.organizationUser],
});
