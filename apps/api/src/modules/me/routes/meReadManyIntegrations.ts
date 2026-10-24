/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:integrations
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyIntegrationsRoute = readRoute({
  model: Modules.me,
  middleware: [validateSelfPermission('read')],
  submodel: Modules.integration,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Integration') },
  responseSchema: integrationReadResponseSchema,
  tags: [Tags.me, Tags.integration],
});
