/**
 * @atlas
 * @kind controller
 * @partOf feature:cronJob, superadmin
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { cronJobTriggerRoute } from '#/modules/admin/cronJob/routes/cronJobTrigger';
import { triggerCronJob } from '#/modules/admin/cronJob/services/triggerCronJob';

export const cronJobTriggerController = makeController(cronJobTriggerRoute, async (c, respond) => {
  const cronJob = contextResource<'cronJob'>(c);
  const { lane } = c.req.valid('json');
  await triggerCronJob(cronJob, lane);
  return respond.noContent();
});
