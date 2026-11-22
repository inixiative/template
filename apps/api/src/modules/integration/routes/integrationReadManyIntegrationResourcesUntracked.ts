/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, feature:auth
 */
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { integrationResourceReadResponseSchema } from '#/modules/integration/schemas/integrationResourceSchemas';
import { Modules } from '#/modules/modules';

export const integrationReadManyIntegrationResourcesUntrackedRoute = readRoute({
  model: Modules.integration,
  submodel: Modules.integrationResource,
  action: 'untracked',
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('IntegrationResource'),
    root: {
      enumPicks: { status: [IntegrationResourceStatus.untracked] },
      where: {
        field: 'status',
        operator: 'equals',
        value: IntegrationResourceStatus.untracked,
      },
    },
  },
  responseSchema: integrationResourceReadResponseSchema,
  middleware: [validateSubmodelPermission('read')],
});
