/**
 * @atlas
 * @kind util
 * @partOf feature:auth
 * @uses none
 */
import type { Passkey, TwoFactor } from '@template/db/generated/client/client';
import type { TwoFactorMethod } from '@template/shared/auth/twoFactor';

export const computeTwoFactorMethods = ({
  twoFactor,
  passkeys,
  rpId,
}: {
  twoFactor: Pick<TwoFactor, 'totpVerifiedAt' | 'backupCodeHashes'> | null;
  passkeys: readonly Pick<Passkey, 'rpId'>[];
  rpId?: string;
}): TwoFactorMethod[] => {
  const methods: TwoFactorMethod[] = [];
  const hasAnyPasskey = passkeys.length > 0;
  const hasDomainPasskey = rpId ? passkeys.some((passkey) => passkey.rpId === rpId) : hasAnyPasskey;
  if (hasDomainPasskey) methods.push('passkey');
  if (twoFactor?.totpVerifiedAt) methods.push('totp');
  if (
    (twoFactor?.backupCodeHashes.length ?? 0) > 0 &&
    (hasAnyPasskey || Boolean(twoFactor?.totpVerifiedAt))
  ) {
    methods.push('backupCode');
  }
  return methods;
};
