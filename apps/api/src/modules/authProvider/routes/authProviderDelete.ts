/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validateActor } from '#/middleware/validations/validateActor';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const authProviderDeleteRoute = deleteRoute({
  model: Modules.authProvider,
  middleware: [validateActor, validatePermission('own')],
});
