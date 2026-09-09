/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:integrations
 */
import { createRoute } from '#/lib/routeTemplates';
import {
  INTEGRATION_IMMUTABLE_FIELDS,
  integrationCreateBodySchema,
  integrationReadResponseSchema,
} from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateIntegrationRoute = createRoute({
  model: Modules.me,
  submodel: Modules.integration,
  skipId: true,
  bodySchema: integrationCreateBodySchema,
  responseSchema: integrationReadResponseSchema,
  sanitizeKeys: INTEGRATION_IMMUTABLE_FIELDS,
  tags: [Tags.me, Tags.integration],
});
