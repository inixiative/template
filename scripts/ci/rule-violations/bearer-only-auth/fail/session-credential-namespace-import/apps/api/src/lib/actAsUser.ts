import * as betterAuthCrypto from 'better-auth/crypto';

export const signSession = (token: string, secret: string) =>
  betterAuthCrypto.makeSignature(token, secret);
