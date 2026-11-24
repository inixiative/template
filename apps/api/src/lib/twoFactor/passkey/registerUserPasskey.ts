/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { db } from '@template/db';
import { assertFirstFactorOrRecentVerify } from '#/lib/twoFactor/assertRecentTwoFactor';
import { ensureTwoFactorRow } from '#/lib/twoFactor/ensureTwoFactorRow';
import { generateBackupCodes } from '#/lib/twoFactor/totp/generateBackupCodes';

type VerifiedRegistrationInfo = NonNullable<VerifiedRegistrationResponse['registrationInfo']>;

export const registerUserPasskey = async ({
  userId,
  name,
  rpId,
  registrationInfo,
  recentlyVerified,
}: {
  userId: string;
  name: string;
  rpId: string;
  registrationInfo: VerifiedRegistrationInfo;
  recentlyVerified: boolean;
}) => {
  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

  return db.txn(async () => {
    const row = await ensureTwoFactorRow(userId);
    await assertFirstFactorOrRecentVerify(row, userId, recentlyVerified);

    const passkey = await db.passkey.create({
      data: {
        userId,
        name,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        rpId,
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: (credential.transports ?? []) as string[],
      },
    });

    const generated = row.backupCodeHashes.length === 0 ? await generateBackupCodes() : null;
    if (generated) {
      await db.twoFactor.update({
        where: { id: row.id },
        data: { backupCodeHashes: generated.hashes, backupCodesGeneratedAt: new Date() },
      });
    }

    await db.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { passkey, backupCodes: generated?.codes ?? null };
  });
};
