/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses none
 */
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { oneTimeToken } from 'better-auth/plugins';

const oauthCallbackToken = (): BetterAuthPlugin => ({
  id: 'oauth-callback-token',
  hooks: {
    after: [
      {
        matcher: (ctx) => !!ctx.path?.startsWith('/callback/'),
        handler: createAuthMiddleware(async (ctx) => {
          const location = ctx.context.responseHeaders?.get('location');
          const ott = ctx.context.responseHeaders?.get('set-ott');
          if (!location || !ott) return;

          const url = new URL(location, ctx.context.baseURL);
          url.hash = `ott=${encodeURIComponent(ott)}`;
          ctx.setHeader('location', url.toString());
        }),
      },
    ],
  },
});

export const oauthHandoffPlugins = () =>
  [
    // Order is load-bearing: plugin after-hooks run in sequence and the redirect rewrite reads `set-ott`.
    oneTimeToken({ expiresIn: 1, storeToken: 'hashed', disableClientRequest: true, setOttHeaderOnNewSession: true }),
    oauthCallbackToken(),
  ] as const;
