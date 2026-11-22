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

export const integrationReadManyIntegrationResourcesRoute = readRoute({
  model: Modules.integration,
  submodel: Modules.integrationResource,
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('IntegrationResource'),
    root: {
      enumOmits: { status: [IntegrationResourceStatus.untracked] },
      where: {
        field: 'status',
        operator: 'notIn',
        value: [IntegrationResourceStatus.untracked],
      },
    },
  },
  responseSchema: integrationResourceReadResponseSchema,
  middleware: [validateSubmodelPermission('read')],
});
