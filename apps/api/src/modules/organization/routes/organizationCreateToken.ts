/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:auth
 */

import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import {
  tokenCreateBodySchema,
  tokenCreateResponseSchema,
} from '#/modules/token/schemas/tokenSchemas';

export const organizationCreateTokenRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.token,
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
});
