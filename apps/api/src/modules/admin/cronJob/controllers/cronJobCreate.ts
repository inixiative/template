/**
 * @atlas
 * @kind controller
 * @partOf feature:cronJob, superadmin
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { omit } from 'lodash-es';
import { makeController } from '#/lib/utils/makeController';
import { cronJobCreateRoute } from '#/modules/admin/cronJob/routes/cronJobCreate';

export const cronJobCreateController = makeController(cronJobCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const user = c.get('user')!;
  const body = c.req.valid('json');

  const cronJob = await db.cronJob.upsert({
    where: { jobId: body.jobId },
    create: { ...body, createdById: user.id },
    update: omit(body, 'createdById'),
  });

  return respond.created(cronJob);
});
