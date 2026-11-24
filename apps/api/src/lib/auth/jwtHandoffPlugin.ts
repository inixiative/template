/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis
 */
import type { User } from '@template/db/generated/client/client';
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware, isAPIError } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { omit } from 'lodash-es';
import { issueUserJwt, type UserJwtHandoff } from '#/lib/auth/issueUserJwt';
import { PRE_TWO_FACTOR_JWT_TTL_SECONDS } from '#/lib/auth/userJwt';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export type { UserJwtHandoff };

const isOAuthCallback = (path: string | undefined) => !!path?.startsWith('/callback/');

const revokesEveryJwt = (path: string | undefined) => path === '/change-password';

export const jwtHandoffPlugin = (): BetterAuthPlugin => ({
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

          const userId = newSession.user.id;
          const twoFactorEnabled = Boolean(
            (newSession.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
          );
          try {
            const isPasswordChange = revokesEveryJwt(ctx.path);
            if (isPasswordChange) await rotateUserJwts(userId);

            const signedIn = (await ctx.context.internalAdapter.updateUser(userId, {
              lastLoginAt: new Date(),
            })) as User;

            const preTwoFactor = !isPasswordChange && (isTwoFactorRequired() || twoFactorEnabled);
            const jwt = await issueUserJwt(signedIn, {
              authCtx: ctx,
              twoFactorVerified: isPasswordChange ? twoFactorEnabled : false,
              ttlSeconds: preTwoFactor ? PRE_TWO_FACTOR_JWT_TTL_SECONDS : undefined,
            });
            return ctx.json({ ...jwt, user: omit(signedIn, 'jwtVersion') });
          } finally {
            await ctx.context.internalAdapter.deleteSession(newSession.session.token);
          }
        }),
      },
    ],
  },
});
