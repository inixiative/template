/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth
 */

import { SessionAction } from '@template/permissions/client';
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
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
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  middleware: [validatePermission(SessionAction.createToken)],
  tags: [Tags.me, Tags.token],
});
