import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { adminUserRedactRoute } from '#/modules/user/routes/adminUserRedact';
import { redactUser } from '#/modules/user/services/redactUser';

export const adminUserRedactController = makeController(adminUserRedactRoute, async (c, respond) => {
  const user = getResource<'user'>(c);

  await redactUser(c, user.id);

  return respond.noContent();
});
