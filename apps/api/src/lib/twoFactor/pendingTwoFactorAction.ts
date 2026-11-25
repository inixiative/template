/**
 * @atlas
 * @kind util
 * @partOf feature:auth
 * @uses none
 */
import type { User } from '@template/db/generated/client/client';
import type { TwoFactorAction } from '@template/shared/auth/twoFactor';
import type { Context } from 'hono';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';
import type { AppEnv } from '#/types/appEnv';

export const pendingTwoFactorAction = (
  c: Context<AppEnv>,
  user: Pick<User, 'twoFactorEnabled'>,
): TwoFactorAction | null => {
  if (c.get('token') || c.get('authCredentialKind') === 'token') return null;
  if (isTwoFactorRequired() && !user.twoFactorEnabled) return 'enroll';
  if (c.get('jwtTwoFactorVerified')) return null;
  return user.twoFactorEnabled ? 'verify' : null;
};
