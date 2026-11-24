/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { TwoFactorMethod } from '@template/shared/auth/twoFactor';
import { computeTwoFactorMethods } from '#/lib/twoFactor/computeTwoFactorMethods';

export const fetchUserTwoFactorMethods = async (
  userId: string,
  rpId?: string,
): Promise<TwoFactorMethod[]> => {
  const [twoFactor, passkeys] = await Promise.all([
    db.twoFactor.findFirst({
      where: { userId },
      select: { totpVerifiedAt: true, backupCodeHashes: true },
    }),
    db.passkey.findMany({ where: { userId }, select: { rpId: true } }),
  ]);

  return computeTwoFactorMethods({ twoFactor, passkeys, rpId });
};
