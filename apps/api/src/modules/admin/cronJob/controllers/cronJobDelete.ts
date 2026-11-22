/**
 * @atlas
 * @kind controller
 * @partOf feature:cronJob, superadmin
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { cronJobDeleteRoute } from '#/modules/admin/cronJob/routes/cronJobDelete';

export const cronJobDeleteController = makeController(cronJobDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const cronJob = contextResource<'cronJob'>(c);

  await db.cronJob.delete({
    where: { id: cronJob.id },
  });

  return respond.noContent();
});
