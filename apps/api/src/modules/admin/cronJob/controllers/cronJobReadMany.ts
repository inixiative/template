/**
 * @atlas
 * @kind controller
 * @partOf feature:cronJob, superadmin
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { makeController } from '#/lib/utils/makeController';
import { cronJobReadManyRoute } from '#/modules/admin/cronJob/routes/cronJobReadMany';

export const cronJobReadManyController = makeController(cronJobReadManyRoute, async (c, respond) => {
  const db = c.get('db');

  const cronJobs = await db.cronJob.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return respond.ok(cronJobs);
});
