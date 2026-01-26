import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { cronJobCreateRoute } from '#/modules/admin/cronJob/routes/cronJobCreate';

export const cronJobCreateController = makeController(cronJobCreateRoute, async (c, respond) => {
  const db = c.get('db');
  const user = getUser(c)!;
  const body = c.req.valid('json');

  const cronJob = await db.cronJob.create({
    data: {
      ...body,
      createdById: user.id,
    },
  });

  return respond.created(cronJob);
});
