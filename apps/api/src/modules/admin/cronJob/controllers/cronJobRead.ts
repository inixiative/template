import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { cronJobReadRoute } from '#/modules/admin/cronJob/routes/cronJobRead';

export const cronJobReadController = makeController(cronJobReadRoute, async (c, respond) => {
  const cronJob = getResource(c);
  return respond.ok(cronJob);
});
