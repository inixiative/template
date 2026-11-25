/**
 * @atlas
 * @kind constant
 * @partOf feature:auth
 * @uses none
 */
export const TWO_FACTOR_REVERIFY_REQUIRED_CODE = 'TWO_FACTOR_REVERIFY_REQUIRED';
export const TWO_FACTOR_ENROLLMENT_REQUIRED_CODE = 'TWO_FACTOR_ENROLLMENT_REQUIRED';
export const TWO_FACTOR_VERIFICATION_REQUIRED_CODE = 'TWO_FACTOR_VERIFICATION_REQUIRED';

export const TWO_FACTOR_TOTP_DIGITS = 6;
export const TWO_FACTOR_TOTP_PERIOD_SECONDS = 30;
export const TWO_FACTOR_BACKUP_CODE_COUNT = 10;

export const TwoFactorMethod = {
  passkey: 'passkey',
  totp: 'totp',
  backupCode: 'backupCode',
} as const;

export type TwoFactorMethod = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod];

export const TWO_FACTOR_METHODS = Object.values(TwoFactorMethod) as [
  TwoFactorMethod,
  ...TwoFactorMethod[],
];

export const TwoFactorAction = {
  verify: 'verify',
  enroll: 'enroll',
} as const;

export type TwoFactorAction = (typeof TwoFactorAction)[keyof typeof TwoFactorAction];

export const TWO_FACTOR_ACTIONS = Object.values(TwoFactorAction) as [
  TwoFactorAction,
  ...TwoFactorAction[],
];
