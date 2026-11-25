/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db, Prisma } from '@template/db';
import type { TwoFactor } from '@template/db/generated/client/client';
import { clearPendingTotpSetup } from '#/lib/twoFactor/pendingTotpSetup';
import { clearPendingWebAuthnChallenges } from '#/lib/twoFactor/pendingWebAuthnChallenge';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const resetUserTwoFactor = async (userId: string): Promise<void> => {
  await db.txn(async () => {
    const [row] = await db.findForUpdate<TwoFactor>('TwoFactor', { userId }, { upserting: true });
    if (row) {
      await db.twoFactor.update({
        where: { id: row.id },
        data: {
          encryptedTotpSecret: null,
          encryptedTotpSecretMetadata: Prisma.DbNull,
          encryptedTotpSecretKeyVersion: null,
          totpVerifiedAt: null,
          backupCodeHashes: [],
          backupCodesGeneratedAt: null,
        },
      });
    }
    await db.passkey.updateManyAndReturn({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
    await rotateUserJwts(userId);
  });
  await Promise.all([clearPendingTotpSetup(userId), clearPendingWebAuthnChallenges(userId)]);
};
