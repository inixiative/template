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
import { OpenApiTags } from '#/modules/openApiTags';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const spaceReadManyTokensRoute = readRoute({
  model: Modules.space,
  submodel: Modules.token,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Token') },
  responseSchema: tokenReadResponseSchema,
  middleware: [validateSubmodelPermission('read')],
  tags: [OpenApiTags.token],
});
