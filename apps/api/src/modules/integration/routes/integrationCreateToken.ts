/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, feature:auth
 */
import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import {
  tokenCreateBodySchema,
  tokenCreateResponseSchema,
} from '#/modules/token/schemas/tokenSchemas';

export const integrationCreateTokenRoute = createRoute({
  model: Modules.integration,
  submodel: Modules.token,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
});
