/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:encryption, primitive:errors
 */
import { db } from '@template/db';
import { encryptField } from '@template/db/lib/encryption/fieldEncryption';
import { assertFirstFactorOrRecentVerify } from '#/lib/twoFactor/assertRecentTwoFactor';
import { ensureTwoFactorRow } from '#/lib/twoFactor/ensureTwoFactorRow';
import { generateBackupCodes } from '#/lib/twoFactor/totp/generateBackupCodes';

export const enableUserTotp = async (
  userId: string,
  secret: string,
  recentlyVerified: boolean,
): Promise<{ backupCodes: string[] | null }> => {
  return db.txn(async () => {
    const row = await ensureTwoFactorRow(userId);
    await assertFirstFactorOrRecentVerify(row, userId, recentlyVerified);

    const encrypted = await encryptField('twoFactor', 'totpSecret', {
      id: row.id,
      userId,
      totpSecret: secret,
    });
    const generated = row.backupCodeHashes.length === 0 ? await generateBackupCodes() : null;
    const now = new Date();

    await db.twoFactor.update({
      where: { id: row.id },
      data: {
        ...encrypted,
        totpVerifiedAt: now,
        ...(generated ? { backupCodeHashes: generated.hashes, backupCodesGeneratedAt: now } : {}),
      },
    });
    await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { backupCodes: generated?.codes ?? null };
  });
};
