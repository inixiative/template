/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:auth
 */

import { SessionAction } from '@template/permissions/client';
import { createRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { Modules } from '#/modules/modules';
import {
  tokenCreateBodySchema,
  tokenCreateResponseSchema,
} from '#/modules/token/schemas/tokenSchemas';

export const organizationUserCreateTokenRoute = createRoute({
  model: Modules.organizationUser,
  submodel: Modules.token,
  bodySchema: tokenCreateBodySchema,
  responseSchema: tokenCreateResponseSchema,
  middleware: [validateSelfPermission(SessionAction.createToken)],
});
