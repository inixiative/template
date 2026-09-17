/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:errors, primitive:requestContext, infrastructure:observability
 */
import { getRedisClient, redisNamespace } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { errorReporter } from '#/lib/errorReporter';
import { makeError } from '#/lib/errors';
import { incrementFixedWindows } from '#/middleware/rateLimit/queries/incrementFixedWindows';
import type { AppEnv } from '#/types/appEnv';

// Rules AND together: every rule must pass. An OR would let a tenant buy N times the throughput by minting N tokens.
export type RateLimitRule = {
  scope: string;
  windowMs: number;
  max: number | ((c: Context<AppEnv>) => number);
  key: (c: Context<AppEnv>) => string | null;
};

export type RateLimitOptions = {
  onLimited?: (c: Context<AppEnv>, retryAfterSeconds: number) => Response | Promise<Response>;
};

type ActiveRule = { rule: RateLimitRule; identity: string };

const windowKey = ({ rule, identity }: ActiveRule) =>
  `${redisNamespace.limit}:${rule.scope}:${rule.windowMs}:${identity}`;

export const rateLimit =
  (rules: RateLimitRule[], options: RateLimitOptions = {}): MiddlewareHandler<AppEnv> =>
  async (c: Context<AppEnv>, next: Next) => {
    const active = rules
      .map((rule) => ({ rule, identity: rule.key(c) }))
      .filter((entry): entry is ActiveRule => entry.identity !== null);

    if (!active.length) return next();

    let retryAfterSeconds: number | null = null;
    try {
      const states = await incrementFixedWindows(
        getRedisClient(),
        active.map((entry) => ({ key: windowKey(entry), windowMs: entry.rule.windowMs })),
      );

      for (const [i, { rule }] of active.entries()) {
        const state = states[i];
        const max = typeof rule.max === 'function' ? rule.max(c) : rule.max;
        if (state && state.count > max) {
          retryAfterSeconds = Math.max(1, Math.ceil(state.ttlMs / 1000));
          break;
        }
      }
    } catch (err) {
      // Abuse protection, not authz: a Redis outage must not take the API down with it.
      log.warn('rateLimit: redis unavailable, allowing request', { err }, LogScope.api);
      errorReporter.captureException(err, { extra: { component: 'rateLimit' } });
    }

    if (retryAfterSeconds === null) return next();
    if (options.onLimited) return options.onLimited(c, retryAfterSeconds);

    throw makeError({
      status: 429,
      message: 'Rate limit exceeded',
      headers: { 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' },
    });
  };
