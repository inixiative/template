/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses none
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { authProviderDeleteRoute } from '#/modules/authProvider/routes/authProviderDelete';

export const authProviderDeleteController = makeController(
  authProviderDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const authProvider = contextResource<'authProvider'>(c);

    await db.authProvider.update({
      where: { id: authProvider.id },
      data: { deletedAt: new Date() },
    });

    return respond.noContent();
  },
);
