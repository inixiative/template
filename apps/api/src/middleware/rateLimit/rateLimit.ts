/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:errors, primitive:requestContext, infrastructure:observability
 */
import { redisClient, redisNamespace } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { errorReporter } from '#/lib/errorReporter';
import { makeError } from '#/lib/errors';
import { isSystemProbe } from '#/lib/utils/authProbe';
import { incrementFixedWindows } from '#/middleware/rateLimit/queries/incrementFixedWindows';
import type { RateLimitKey } from '#/middleware/rateLimit/rateLimitKeys';
import type { AppEnv } from '#/types/appEnv';

// Rules AND together: every rule must pass. An OR would let a tenant buy N times the throughput by minting N tokens.
export type RateLimitRule = {
  scope: string;
  windowMs: number;
  max: number | ((c: Context<AppEnv>) => number);
  key: (c: Context<AppEnv>) => RateLimitKey | null;
};

export type RateLimitOptions = {
  cost?: number | ((c: Context<AppEnv>) => number);
  onLimited?: (c: Context<AppEnv>, retryAfterSeconds: number) => Response | Promise<Response>;
};

type ActiveRule = { rule: RateLimitRule; key: RateLimitKey };

const windowKey = ({ rule, key }: ActiveRule) =>
  `${redisNamespace.limit}:${rule.scope}:${rule.windowMs}:${key}`;

export const enforceRateLimit = async (
  c: Context<AppEnv>,
  rules: RateLimitRule[],
  options: RateLimitOptions = {},
): Promise<Response | undefined> => {
  const cost = typeof options.cost === 'function' ? options.cost(c) : (options.cost ?? 1);
  if (!Number.isSafeInteger(cost) || cost < 0) {
    throw new RangeError(`Rate limit cost must be a non-negative integer, got ${cost}`);
  }
  if (cost === 0) return undefined;
  // why: a system probe re-checks a request already admitted; limiting it would leave the check unmade
  if (isSystemProbe(c)) return undefined;

  const active = rules
    .map((rule) => ({
      rule,
      key: rule.key(c),
      max: typeof rule.max === 'function' ? rule.max(c) : rule.max,
    }))
    .filter((entry): entry is ActiveRule & { max: number } => entry.key !== null);

  if (!active.length) return undefined;

  let retryAfterSeconds: number | null = null;
  try {
    const states = await incrementFixedWindows(
      redisClient(),
      active.map((entry) => ({
        key: windowKey(entry),
        windowMs: entry.rule.windowMs,
        cost,
        max: entry.max,
      })),
    );

    for (const [i, { max }] of active.entries()) {
      const state = states[i];
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

  if (retryAfterSeconds === null) return undefined;
  if (options.onLimited) return options.onLimited(c, retryAfterSeconds);

  throw makeError({
    status: 429,
    message: 'Rate limit exceeded',
    headers: { 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' },
  });
};

export const rateLimit =
  (rules: RateLimitRule[], options: RateLimitOptions = {}): MiddlewareHandler<AppEnv> =>
  async (c: Context<AppEnv>, next: Next) => {
    const limited = await enforceRateLimit(c, rules, options);
    if (limited) return limited;
    return next();
  };
