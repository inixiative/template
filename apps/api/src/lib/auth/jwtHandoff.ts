/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware, isAPIError } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { signJWT } from 'better-auth/plugins';
import { omit } from 'lodash-es';
import { USER_JWT_TTL_SECONDS, userJwtOptions } from '#/lib/auth/userJwt';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export type UserJwtHandoff = { token: string; expiresAt: string };

// The OAuth callback's session must outlive its redirect: the one-time token resolves to it.
const isOAuthCallback = (path: string | undefined) => !!path?.startsWith('/callback/');

const revokesEveryJwt = (path: string | undefined) => path === '/change-password';

export const jwtHandoff = (): BetterAuthPlugin => ({
  id: 'jwt-handoff',
  hooks: {
    after: [
      {
        matcher: (ctx) => !!ctx.context.newSession,
        handler: createAuthMiddleware(async (ctx) => {
          const newSession = ctx.context.newSession;
          if (!newSession) return;
          deleteSessionCookie(ctx);
          if (isOAuthCallback(ctx.path) || isAPIError(ctx.context.returned)) return;

          try {
            if (revokesEveryJwt(ctx.path)) await rotateUserJwts(newSession.user.id);
            const iat = Math.floor(Date.now() / 1000);
            const signedIn = (await ctx.context.internalAdapter.updateUser(newSession.user.id, {
              lastLoginAt: new Date(iat * 1000),
            })) as { jwtVersion?: number } | null;
            if (typeof signedIn?.jwtVersion !== 'number')
              throw new Error('Signed-in user has no jwtVersion to put on the JWT');
            const token = await signJWT(ctx, {
              options: userJwtOptions(),
              payload: { sub: newSession.user.id, ver: signedIn.jwtVersion, iat },
            });

            const handoff: UserJwtHandoff & {
              user: Omit<typeof newSession.user, 'jwtVersion'>;
            } = {
              token,
              expiresAt: new Date((iat + USER_JWT_TTL_SECONDS) * 1000).toISOString(),
              user: omit(newSession.user, 'jwtVersion'),
            };
            return ctx.json(handoff);
          } finally {
            await ctx.context.internalAdapter.deleteSession(newSession.session.token);
          }
        }),
      },
    ],
  },
});
