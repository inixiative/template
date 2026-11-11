/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth, feature:tenancy
 */
import { OrganizationScalarSchema, SpaceScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { organizationUserReadResponseSchema } from '#/modules/organizationUser/schemas/organizationUserSchemas';
import { spaceUserReadResponseSchema } from '#/modules/spaceUser/schemas/spaceUserSchemas';
import { Tags } from '#/modules/tags';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

const responseSchema = tokenReadResponseSchema.extend({
  organization: OrganizationScalarSchema.nullable(),
  organizationUser: organizationUserReadResponseSchema.nullable(),
  space: SpaceScalarSchema.nullable(),
  spaceUser: spaceUserReadResponseSchema.nullable(),
});

export const meReadManyTokensRoute = readRoute({
  model: Modules.me,
  middleware: [validateSubmodelPermission('read')],
  submodel: Modules.token,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Token') },
  responseSchema,
  tags: [Tags.me, Tags.token],
});
