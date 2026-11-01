/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth, feature:tenancy
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const meReadManyTokensRoute = readRoute({
  model: Modules.me,
  middleware: [validateSubmodelPermission('read')],
  submodel: Modules.token,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Token') },
  responseSchema: tokenReadResponseSchema,
  tags: [Tags.me, Tags.token],
});
