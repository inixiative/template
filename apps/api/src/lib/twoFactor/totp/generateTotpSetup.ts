/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import * as OTPAuth from 'otpauth';
import { createTotp } from '#/lib/twoFactor/totp/generateTotpCode';

export const generateTotpSetup = ({
  issuer,
  accountName,
}: {
  issuer: string;
  accountName: string;
}): { secret: string; otpauthUri: string; issuer: string; accountName: string } => {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const otpauthUri = createTotp(secret, { issuer, label: accountName }).toString();

  return {
    secret,
    otpauthUri,
    issuer,
    accountName,
  };
};
