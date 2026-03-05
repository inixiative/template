import { makeController } from '#/lib/utils/makeController';
import { meRedactRoute } from '#/modules/me/routes/meRedact';
import { redactUser } from '#/modules/user/services/redactUser';

export const meRedactController = makeController(meRedactRoute, async (c, respond) => {
  const user = c.get('user')!;

  await redactUser(c, user.id);

  return respond.noContent();
});
