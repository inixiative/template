/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:auth
 */

import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import {
  tokenCreateBodySchema,
  tokenCreateResponseSchema,
} from '#/modules/token/schemas/tokenSchemas';

export const spaceCreateTokenRoute = createRoute({
  model: Modules.space,
  submodel: Modules.token,
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  tags: [Tags.token],
});
