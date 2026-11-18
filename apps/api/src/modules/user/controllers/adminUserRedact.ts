/**
 * @atlas
 * @kind controller
 * @partOf feature:users, superadmin
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { adminUserRedactRoute } from '#/modules/user/routes/adminUserRedact';
import { redactUser } from '#/modules/user/services/redactUser';

export const adminUserRedactController = makeController(
  adminUserRedactRoute,
  async (c, respond) => {
    const user = contextResource<'user'>(c);

    await redactUser(c, user.id);

    return respond.noContent();
  },
);
