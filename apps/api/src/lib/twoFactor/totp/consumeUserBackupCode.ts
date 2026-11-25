/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import type { TwoFactor } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { consumeMatchingBackupCode } from '#/lib/twoFactor/totp/matchBackupCode';

export const consumeUserBackupCode = async (userId: string, code: string): Promise<void> => {
  await db.txn(async () => {
    const [row] = await db.findForUpdate<TwoFactor>('TwoFactor', { userId });
    if (!row || row.backupCodeHashes.length === 0)
      throw makeError({ status: 401, message: 'Invalid backup code' });

    const remaining = await consumeMatchingBackupCode(code, row.backupCodeHashes);
    await db.twoFactor.update({
      where: { id: row.id },
      data: { backupCodeHashes: remaining },
    });
  });
};
