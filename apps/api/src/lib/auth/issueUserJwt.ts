/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import type { User } from '@template/db/generated/client/client';
import { signJWT } from 'better-auth/plugins';
import { USER_JWT_TTL_SECONDS, userJwtOptions } from '#/lib/auth/userJwt';

export type UserJwtHandoff = {
  token: string;
  expiresAt: string;
};

type BetterAuthSignCtx = Parameters<typeof signJWT>[0];

type IssueUserJwtOptions = {
  twoFactorVerified?: boolean;
  recentTwoFactor?: boolean;
  ttlSeconds?: number;
  authCtx?: BetterAuthSignCtx;
};

export const issueUserJwt = async (
  user: Pick<User, 'id' | 'jwtVersion'>,
  options: IssueUserJwtOptions = {},
): Promise<UserJwtHandoff> => {
  const iat = Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? USER_JWT_TTL_SECONDS;
  const payload = {
    sub: user.id,
    ver: user.jwtVersion,
    iat,
    ...(options.twoFactorVerified ? { twoFactor: true } : {}),
    ...(options.recentTwoFactor ? { twoFactorVerifiedAt: iat } : {}),
  };
  const jwtOpts = userJwtOptions(ttlSeconds);

  const signViaApp = async () => {
    const { auth } = await import('#/lib/auth');
    const { token } = await auth.api.signJWT({
      body: { payload, overrideOptions: { jwt: jwtOpts.jwt } },
    });
    return token;
  };
  const token = options.authCtx
    ? await signJWT(options.authCtx, { options: jwtOpts, payload })
    : await signViaApp();

  return {
    token,
    expiresAt: new Date((iat + ttlSeconds) * 1000).toISOString(),
  };
};
