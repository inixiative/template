/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import {
  TWO_FACTOR_ENROLLMENT_REQUIRED_CODE,
  TWO_FACTOR_METHODS,
  TWO_FACTOR_REVERIFY_REQUIRED_CODE,
  TWO_FACTOR_VERIFICATION_REQUIRED_CODE,
  type TwoFactorAction,
  type TwoFactorMethod,
} from '@template/shared/auth/twoFactor';

const VALID_METHODS = new Set<string>(TWO_FACTOR_METHODS);

export const TWO_FACTOR_METHOD_LABELS: Record<TwoFactorMethod, string> = {
  passkey: 'Passkey',
  totp: 'Authenticator app',
  backupCode: 'Backup code',
};

export class TwoFactorVerifyCancelledError extends Error {
  constructor() {
    super('Two-factor verification cancelled');
    this.name = 'TwoFactorVerifyCancelledError';
  }
}

type ErrorDetail = { code?: string; methods?: unknown };

const errorDetails = (error: unknown): ErrorDetail[] => {
  const details = (error as { details?: unknown } | null)?.details;
  return Array.isArray(details) ? (details as ErrorDetail[]) : [];
};

export const reverifyMethodsFromError = (error: unknown): TwoFactorMethod[] | null => {
  const match = errorDetails(error).find(
    (item) => item?.code === TWO_FACTOR_REVERIFY_REQUIRED_CODE,
  );
  if (!match) return null;
  if (!Array.isArray(match.methods)) return [];
  return match.methods.filter(
    (method): method is TwoFactorMethod => typeof method === 'string' && VALID_METHODS.has(method),
  );
};

export const twoFactorActionFromError = (error: unknown): TwoFactorAction | null => {
  const match = errorDetails(error).find(
    (item) =>
      item?.code === TWO_FACTOR_ENROLLMENT_REQUIRED_CODE ||
      item?.code === TWO_FACTOR_VERIFICATION_REQUIRED_CODE,
  );
  if (!match) return null;
  return match.code === TWO_FACTOR_ENROLLMENT_REQUIRED_CODE ? 'enroll' : 'verify';
};
