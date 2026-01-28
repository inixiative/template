import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { meRedactRoute } from '#/modules/me/routes/meRedact';
import { redactUser } from '#/modules/user/services/redactUser';

export const meRedactController = makeController(meRedactRoute, async (c, respond) => {
  const db = c.get('db');
  const user = getUser(c)!;

  await redactUser(db, user.id);

  return respond.noContent();
});
