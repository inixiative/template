/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import type { TwoFactor } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const deleteUserPasskey = async (userId: string, passkeyId: string): Promise<void> => {
  await db.txn(async () => {
    const [row] = await db.findForUpdate<TwoFactor>('TwoFactor', { userId }, { upserting: true });
    const passkey = await db.passkey.findFirst({ where: { id: passkeyId, userId } });
    if (!passkey) throw makeError({ status: 404, message: 'Passkey not found' });

    const otherPasskeys = await db.passkey.count({ where: { userId, id: { not: passkeyId } } });
    const hasTotp = Boolean(row?.totpVerifiedAt);
    if (isTwoFactorRequired() && otherPasskeys === 0 && !hasTotp) {
      throw makeError({
        status: 422,
        message:
          'Two-factor authentication is required. Add another passkey or authenticator app before removing your last one.',
      });
    }

    await db.passkey.update({ where: { id: passkeyId }, data: { deletedAt: new Date() } });

    if (otherPasskeys === 0 && !hasTotp) {
      if (row) {
        await db.twoFactor.update({
          where: { id: row.id },
          data: { backupCodeHashes: [], backupCodesGeneratedAt: null },
        });
      }
      await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
      await rotateUserJwts(userId);
    }
  });
};
