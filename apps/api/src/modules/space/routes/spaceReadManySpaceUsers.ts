/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { UserScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { spaceUserReadResponseSchema } from '#/modules/spaceUser/schemas/spaceUserSchemas';
import { Tags } from '#/modules/tags';

const responseSchema = spaceUserReadResponseSchema.extend({
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
