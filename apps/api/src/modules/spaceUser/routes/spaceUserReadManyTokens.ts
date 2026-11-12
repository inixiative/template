/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:auth
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const spaceUserReadManyTokensRoute = readRoute({
  model: Modules.spaceUser,
  submodel: Modules.token,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Token') },
  responseSchema: tokenReadResponseSchema,
  middleware: [validateSubmodelPermission('read')],
});
