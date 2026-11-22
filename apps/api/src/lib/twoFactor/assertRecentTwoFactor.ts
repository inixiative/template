/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import type { TwoFactor } from '@template/db/generated/client/client';
import { isSuperadmin } from '@template/permissions';
import { TWO_FACTOR_REVERIFY_REQUIRED_CODE } from '@template/shared/auth/twoFactor';
import type { Context } from 'hono';
import { TWO_FACTOR_REVERIFY_TTL_SECONDS } from '#/lib/auth/userJwt';
import { realUserActor } from '#/lib/context/realUserActor';
import { makeError } from '#/lib/errors';
import { fetchUserTwoFactorMethods } from '#/lib/twoFactor/fetchUserTwoFactorMethods';
import { rpIdFromOrigin } from '#/lib/twoFactor/passkey/resolveWebAuthnOrigin';
import type { AppEnv } from '#/types/appEnv';

export const isRecentTwoFactor = (c: Context<AppEnv>): boolean => {
  const verifiedAt = c.get('jwtTwoFactorVerifiedAt');
  return (
    typeof verifiedAt === 'number' &&
    Math.floor(Date.now() / 1000) - verifiedAt < TWO_FACTOR_REVERIFY_TTL_SECONDS
  );
};

export const assertFirstFactorOrRecentVerify = async (
  row: Pick<TwoFactor, 'totpVerifiedAt'>,
  userId: string,
  recentlyVerified: boolean,
): Promise<void> => {
  if (recentlyVerified) return;
  const passkeyCount = await db.passkey.count({ where: { userId } });
  if (row.totpVerifiedAt || passkeyCount > 0) {
    throw makeError({
      status: 403,
      message: 'Two-factor verification required',
      details: [{ code: TWO_FACTOR_REVERIFY_REQUIRED_CODE }],
    });
  }
};

export const assertRecentTwoFactor = async (c: Context<AppEnv>): Promise<void> => {
  const token = c.get('token');
  if (token) {
    if (token.user?.twoFactorEnabled && isSuperadmin(token.user)) {
      throw makeError({
        status: 403,
        message: 'Two-factor verification required; use a signed-in user session',
      });
    }
    return;
  }

  const actor = realUserActor(c);
  if (!actor?.twoFactorEnabled) return;
  if (isRecentTwoFactor(c)) return;

  const methods = await fetchUserTwoFactorMethods(actor.id, rpIdFromOrigin(c.req.header('origin')));

  throw makeError({
    status: 403,
    message: 'Two-factor verification required',
    details: [
      {
        code: TWO_FACTOR_REVERIFY_REQUIRED_CODE,
        methods,
        actions: {
          verify: 'POST /api/v1/me/twoFactor/verify',
          passkeyOptions: 'POST /api/v1/me/twoFactor/verify/passkey/options',
        },
      },
    ],
  });
};
