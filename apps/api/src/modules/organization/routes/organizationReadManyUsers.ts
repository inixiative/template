/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { organizationUserReadResponseSchema } from '#/modules/organizationUser/schemas/organizationUserSchemas';
import { Tags } from '#/modules/tags';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

const responseSchema = userResponseSchema.extend({
  organizationUser: organizationUserReadResponseSchema,
});

export const organizationReadManyUsersRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.user,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('User') },
  responseSchema,
  middleware: [validatePermission('read')],
  tags: [Tags.user, Tags.organizationUser],
});
