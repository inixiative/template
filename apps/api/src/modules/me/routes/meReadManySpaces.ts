/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:tenancy
 */
import { OrganizationScalarSchema, SpaceScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { organizationUserReadResponseSchema } from '#/modules/organizationUser/schemas/organizationUserSchemas';
import { spaceUserReadResponseSchema } from '#/modules/spaceUser/schemas/spaceUserSchemas';
import { Tags } from '#/modules/tags';

const responseSchema = SpaceScalarSchema.extend({
  organization: OrganizationScalarSchema,
  organizationUser: organizationUserReadResponseSchema,
  spaceUser: spaceUserReadResponseSchema,
});

export const meReadManySpacesRoute = readRoute({
  model: Modules.me,
  middleware: [validatePermission('read')],
  submodel: Modules.space,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Space') },
  responseSchema,
  tags: [Tags.me, Tags.space, Tags.spaceUser, Tags.organization, Tags.organizationUser],
});
