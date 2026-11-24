/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import {
  TWO_FACTOR_REVERIFY_REQUIRED_CODE,
  type TwoFactorMethod,
} from '@template/shared/auth/twoFactor';

export const TWO_FACTOR_METHOD_LABELS: Record<TwoFactorMethod, string> = {
  passkey: 'Passkey',
  totp: 'Authenticator app',
  backupCode: 'Backup code',
};

export const isTwoFactorReverifyError = (error: unknown): boolean => {
  const details = (error as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) return false;
  return details.some(
    (item) => (item as { code?: unknown } | null)?.code === TWO_FACTOR_REVERIFY_REQUIRED_CODE,
  );
};
