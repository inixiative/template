/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { fetchUserHasCredentialPassword } from '#/lib/auth/verifyUserPassword';
import { computeTwoFactorMethods } from '#/lib/twoFactor/computeTwoFactorMethods';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';

export const fetchUserTwoFactorStatus = async (userId: string, rpId?: string) => {
  const [twoFactor, passkeys, hasPassword] = await Promise.all([
    db.twoFactor.findFirst({ where: { userId } }),
    db.passkey.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    fetchUserHasCredentialPassword(userId),
  ]);

  const totpEnabled = Boolean(twoFactor?.totpVerifiedAt);
  const enabled = totpEnabled || passkeys.length > 0;

  return {
    enabled,
    required: isTwoFactorRequired(),
    totpEnabled,
    backupCodesRemaining: twoFactor?.backupCodeHashes.length ?? 0,
    hasPassword,
    methods: computeTwoFactorMethods({ twoFactor, passkeys, rpId }),
    passkeys,
  };
};
