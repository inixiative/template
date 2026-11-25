/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { mePasskeyRenameRoute } from '#/modules/me/routes/mePasskeyRename';

export const mePasskeyRenameController = makeController(
  mePasskeyRenameRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const { passkeyId, name } = c.req.valid('json');
    const updated = await db.passkey.update({
      where: { id: passkeyId, userId: user.id },
      data: { name },
    });
    return respond.ok(updated);
  },
);
