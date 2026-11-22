/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:redis, primitive:encryption, primitive:errors
 */
import { redisClient, redisNamespace } from '@template/db';
import { decryptField, encryptField } from '@template/db/lib/encryption/fieldEncryption';
import { makeError } from '#/lib/errors';

const TOTP_SETUP_TTL_SECONDS = 15 * 60;
const setupKey = (userId: string) => `${redisNamespace.otp}:totp-setup:${userId}`;

type EncryptedPendingTotp = {
  encryptedTotpSecret: string;
  encryptedTotpSecretMetadata: { iv: string; authTag: string };
  encryptedTotpSecretKeyVersion: number;
};

export const storePendingTotpSetup = async (userId: string, secret: string): Promise<void> => {
  const encrypted = await encryptField('twoFactor', 'totpSecret', {
    id: 'pending',
    userId,
    totpSecret: secret,
  });
  await redisClient().setex(setupKey(userId), TOTP_SETUP_TTL_SECONDS, JSON.stringify(encrypted));
};

export const fetchPendingTotpSetupOrThrow = async (userId: string): Promise<string> => {
  const raw = await redisClient().get(setupKey(userId));
  if (!raw)
    throw makeError({ status: 400, message: 'Authenticator setup expired. Start setup again.' });

  const parsed = JSON.parse(raw) as EncryptedPendingTotp;
  return (await decryptField('twoFactor', 'totpSecret', {
    id: 'pending',
    userId,
    ...parsed,
  })) as string;
};

export const clearPendingTotpSetup = async (userId: string): Promise<void> => {
  await redisClient().del(setupKey(userId));
};
