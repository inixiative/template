/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses primitive:errors
 */
import { isSuperadmin } from '@template/permissions';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const assertNotSuperadminTokenWithTwoFactor = (c: Context<AppEnv>): void => {
  const token = c.get('token');
  if (!token && c.get('authCredentialKind') !== 'token') return;

  const tokenUser = token?.user ?? c.get('spoofedBy');
  if (tokenUser?.twoFactorEnabled && isSuperadmin(tokenUser)) {
    throw makeError({
      status: 403,
      message: 'Two-factor verification required; use a signed-in user session',
    });
  }
};
