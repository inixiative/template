/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { SessionAction } from '@template/permissions/client';
import { updateRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { Modules } from '#/modules/modules';
import {
  tokenReadResponseSchema,
  tokenUpdateBodySchema,
} from '#/modules/token/schemas/tokenSchemas';

export const tokenUpdateRoute = updateRoute({
  model: Modules.token,
  bodySchema: tokenUpdateBodySchema,
  responseSchema: tokenReadResponseSchema,
  description:
    'Changes a token: its name, role, whether it is full (entitlements null) or narrowed, and which integrations it reaches. A token cannot change itself.',
  middleware: [validateSelfPermission(SessionAction.createToken)],
});
