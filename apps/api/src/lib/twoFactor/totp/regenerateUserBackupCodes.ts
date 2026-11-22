/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import { makeError } from '#/lib/errors';
import { ensureTwoFactorRow } from '#/lib/twoFactor/ensureTwoFactorRow';
import { generateBackupCodes } from '#/lib/twoFactor/totp/generateBackupCodes';

export const regenerateUserBackupCodes = async (
  userId: string,
): Promise<{ backupCodes: string[] }> => {
  return db.txn(async () => {
    const row = await ensureTwoFactorRow(userId);
    const activePasskeys = await db.passkey.count({ where: { userId } });
    if (!row.totpVerifiedAt && activePasskeys === 0) {
      throw makeError({
        status: 422,
        message: 'Enable an authenticator app or passkey before generating backup codes.',
      });
    }

    const { codes, hashes } = await generateBackupCodes();
    await db.twoFactor.update({
      where: { id: row.id },
      data: { backupCodeHashes: hashes, backupCodesGeneratedAt: new Date() },
    });
    return { backupCodes: codes };
  });
};
