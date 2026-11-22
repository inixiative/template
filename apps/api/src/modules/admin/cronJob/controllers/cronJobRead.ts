/**
 * @atlas
 * @kind controller
 * @partOf feature:cronJob, superadmin
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { cronJobReadRoute } from '#/modules/admin/cronJob/routes/cronJobRead';

export const cronJobReadController = makeController(cronJobReadRoute, async (c, respond) => {
  const cronJob = contextResource<'cronJob'>(c);
  return respond.ok(cronJob);
});
