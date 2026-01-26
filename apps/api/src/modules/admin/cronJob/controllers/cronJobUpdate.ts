import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { cronJobUpdateRoute } from '#/modules/admin/cronJob/routes/cronJobUpdate';

export const cronJobUpdateController = makeController(cronJobUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const cronJob = getResource<'cronJob'>(c);
  const body = c.req.valid('json');

  const updated = await db.cronJob.update({
    where: { id: cronJob.id },
    data: body,
  });

  return respond.ok(updated);
});
