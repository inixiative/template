/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { IntegrationScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  INTEGRATION_IMMUTABLE_FIELDS,
  integrationUpdateBodySchema,
} from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';

export const integrationUpdateRoute = updateRoute({
  model: Modules.integration,
  middleware: [validatePermission('manage')],
  bodySchema: integrationUpdateBodySchema,
  sanitizeKeys: INTEGRATION_IMMUTABLE_FIELDS,
  responseSchema: IntegrationScalarSchema,
});
