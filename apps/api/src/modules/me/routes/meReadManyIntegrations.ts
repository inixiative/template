/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:integrations
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meReadManyIntegrationsRoute = readRoute({
  model: Modules.me,
  middleware: [validateSubmodelPermission('read')],
  submodel: Modules.integration,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Integration') },
  responseSchema: integrationReadResponseSchema,
  tags: [OpenApiTags.me, OpenApiTags.integration],
});
