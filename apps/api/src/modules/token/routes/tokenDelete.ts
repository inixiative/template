/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { SessionAction } from '@template/permissions/client';
import { deleteRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { Modules } from '#/modules/modules';

export const tokenDeleteRoute = deleteRoute({
  model: Modules.token,
  middleware: [validateSelfPermission(SessionAction.deleteToken)],
});
