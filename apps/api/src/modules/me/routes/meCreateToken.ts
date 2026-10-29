/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth
 */

import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import {
  tokenCreateBodySchema,
  tokenCreateResponseSchema,
} from '#/modules/token/schemas/tokenSchemas';

export const meCreateTokenRoute = createRoute({
  model: Modules.me,
  submodel: Modules.token,
  skipId: true,
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  tags: [Tags.me, Tags.token],
});
