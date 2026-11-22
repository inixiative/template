/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { deleteUserPasskey } from '#/lib/twoFactor/passkey/deleteUserPasskey';
import { makeController } from '#/lib/utils/makeController';
import { mePasskeyDeleteRoute } from '#/modules/me/routes/mePasskeyDelete';

export const mePasskeyDeleteController = makeController(
  mePasskeyDeleteRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const { passkeyId } = c.req.valid('json');
    await deleteUserPasskey(user.id, passkeyId);
    return respond.noContent();
  },
);
