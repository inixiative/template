/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { db } from '@template/db';
import { decryptField } from '@template/db/lib/encryption/fieldEncryption';
import { makeError } from '#/lib/errors';
import { verifyTotpCode } from '#/lib/twoFactor/totp/verifyTotpCode';

export const verifyUserTotp = async (userId: string, code: string): Promise<void> => {
  const row = await db.twoFactor.findFirst({ where: { userId } });
  if (!row?.totpVerifiedAt || !row.encryptedTotpSecret) {
    throw makeError({ status: 400, message: 'Authenticator app is not enabled' });
  }

  const secret = (await decryptField('twoFactor', 'totpSecret', {
    id: row.id,
    userId: row.userId,
    encryptedTotpSecret: row.encryptedTotpSecret,
    encryptedTotpSecretMetadata: row.encryptedTotpSecretMetadata as { iv: string; authTag: string },
    encryptedTotpSecretKeyVersion: row.encryptedTotpSecretKeyVersion!,
  })) as string;

  await verifyTotpCode({ userId, secret, code });
};
