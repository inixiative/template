/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 */
import { SpaceUserScalarSchema, UserScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = SpaceUserScalarSchema.extend({
  user: UserScalarSchema,
});

export const spaceReadManySpaceUsersRoute = readRoute({
  model: Modules.space,
  submodel: Modules.spaceUser,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('SpaceUser') },
  responseSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.spaceUser, Tags.user],
});
