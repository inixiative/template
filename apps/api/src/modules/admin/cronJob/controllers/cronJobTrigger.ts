import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { cronJobTriggerRoute } from '#/modules/admin/cronJob/routes/cronJobTrigger';
import { triggerCronJob } from '#/modules/admin/cronJob/services/triggerCronJob';

export const cronJobTriggerController = makeController(cronJobTriggerRoute, async (c, respond) => {
  const cronJob = getResource<'cronJob'>(c);
  await triggerCronJob(cronJob);
  return respond.noContent();
});
