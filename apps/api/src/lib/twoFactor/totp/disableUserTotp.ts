/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { db, Prisma } from '@template/db';
import type { TwoFactor } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const disableUserTotp = async (userId: string): Promise<void> => {
  await db.txn(async () => {
    const [row] = await db.findForUpdate<TwoFactor>('TwoFactor', { userId });
    if (!row?.totpVerifiedAt)
      throw makeError({ status: 400, message: 'Authenticator app is not enabled' });

    const activePasskeys = await db.passkey.count({ where: { userId } });
    if (isTwoFactorRequired() && activePasskeys === 0) {
      throw makeError({
        status: 422,
        message:
          'Two-factor authentication is required. Add a passkey before removing your authenticator app.',
      });
    }

    await db.twoFactor.update({
      where: { id: row.id },
      data: {
        encryptedTotpSecret: null,
        encryptedTotpSecretMetadata: Prisma.DbNull,
        encryptedTotpSecretKeyVersion: null,
        totpVerifiedAt: null,
        ...(activePasskeys === 0 ? { backupCodeHashes: [], backupCodesGeneratedAt: null } : {}),
      },
    });
    if (activePasskeys === 0) {
      await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
      await rotateUserJwts(userId);
    }
  });
};
