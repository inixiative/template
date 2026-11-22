/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:errors
 */
import type { Context, MiddlewareHandler, Next } from 'hono';
import { assertRecentTwoFactor } from '#/lib/twoFactor/assertRecentTwoFactor';
import type { AppEnv } from '#/types/appEnv';

export const requireRecentTwoFactorMiddleware =
  (): MiddlewareHandler<AppEnv> => async (c: Context<AppEnv>, next: Next) => {
    await assertRecentTwoFactor(c);
    await next();
  };
