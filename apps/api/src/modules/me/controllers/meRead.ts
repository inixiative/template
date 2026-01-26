import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { meReadRoute } from '#/modules/me/routes/meRead';

export const meReadController = makeController(meReadRoute, async (c, respond) => {
  const user = getUser(c)!;
  return respond.ok(user);
});
