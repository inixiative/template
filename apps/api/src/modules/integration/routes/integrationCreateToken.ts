/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, feature:auth
 */
import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import {
  tokenCreateBodySchema,
  tokenCreateResponseSchema,
} from '#/modules/token/schemas/tokenSchemas';

export const integrationCreateTokenRoute = createRoute({
  model: Modules.integration,
  submodel: Modules.token,
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
});
