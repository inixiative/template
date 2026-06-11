/**
 * @atlas
 * @kind route
 * @partOf superadmin
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates/delete';
import { Modules } from '#/modules/modules';

export const cronJobDeleteRoute = deleteRoute({
  model: Modules.cronJob,
  admin: true,
});
