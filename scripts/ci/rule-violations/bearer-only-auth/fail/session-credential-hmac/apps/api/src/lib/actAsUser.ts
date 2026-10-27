import { createHMAC } from '@better-auth/utils/hmac';

export const signSession = (token: string, secret: string) =>
  createHMAC('SHA-256', 'base64urlnopad').sign(secret, token);
