import { SpaceUserScalarSchema, UserScalarSchema } from '@template/db';
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
  responseSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.spaceUser, Tags.user],
});
