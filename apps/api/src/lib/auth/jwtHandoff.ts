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
import { jwtValidAfter } from '#/lib/auth/jwtRevocation';
import { PERSON_JWT_TTL_SECONDS, personJwtOptions } from '#/lib/auth/personJwt';

export type PersonJwtHandoff = { token: string; expiresAt: string };

// The OAuth callback's session must outlive its redirect: the one-time token resolves to it.
const isOAuthCallback = (path: string | undefined) => !!path?.startsWith('/callback/');

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

          // A JWT is issued after the user's latest revocation, even one made in this same second.
          const validAfter = await jwtValidAfter(newSession.user.id);
          const iat = Math.max(Math.floor(Date.now() / 1000), (validAfter ?? 0) + 1);
          const token = await signJWT(ctx, {
            options: personJwtOptions(),
            payload: { sub: newSession.user.id, iat },
          });
          await ctx.context.internalAdapter.deleteSession(newSession.session.token);
          await ctx.context.internalAdapter.updateUser(newSession.user.id, {
            lastLoginAt: new Date(iat * 1000),
          });

          const handoff: PersonJwtHandoff & { user: typeof newSession.user } = {
            token,
            expiresAt: new Date((iat + PERSON_JWT_TTL_SECONDS) * 1000).toISOString(),
            user: newSession.user,
          };
          return ctx.json(handoff);
        }),
      },
    ],
  },
});
