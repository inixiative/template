/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:integrations
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';

export const organizationUserReadManyIntegrationsRoute = readRoute({
  model: Modules.organizationUser,
  submodel: Modules.integration,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Integration') },
  responseSchema: integrationReadResponseSchema,
  middleware: [validateSubmodelPermission('read')],
});
