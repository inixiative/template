import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { cronJobDeleteRoute } from '#/modules/admin/cronJob/routes/cronJobDelete';

export const cronJobDeleteController = makeController(cronJobDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const cronJob = getResource<'cronJob'>(c);

  await db.cronJob.delete({
    where: { id: cronJob.id },
  });

  return respond.noContent();
});
