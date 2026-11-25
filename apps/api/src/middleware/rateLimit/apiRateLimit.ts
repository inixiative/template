/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext
 */
import type { Context, MiddlewareHandler, Next } from 'hono';
import { isBatchSubRequest } from '#/lib/context/isBatchSubRequest';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { enforceRateLimit, type RateLimitRule, rateLimit } from '#/middleware/rateLimit/rateLimit';
import {
  organizationRateLimitKey,
  principalRateLimitKey,
  spaceRateLimitKey,
} from '#/middleware/rateLimit/rateLimitKeys';
import type { AppEnv } from '#/types/appEnv';

export const BATCH_SUBREQUESTS_PER_COST_UNIT = 5;

export const batchRateLimitCost = (totalRequests: number): number =>
  Math.max(1, Math.ceil(totalRequests / BATCH_SUBREQUESTS_PER_COST_UNIT));

const apiRateLimitRules: RateLimitRule[] = [
  {
    scope: 'api:principal',
    windowMs: 1_000,
    max: (c) => rateLimitMax('user', c),
    key: principalRateLimitKey,
  },
  {
    scope: 'api:space',
    windowMs: 1_000,
    max: (c) => rateLimitMax('space', c),
    key: spaceRateLimitKey,
  },
  {
    scope: 'api:organization',
    windowMs: 1_000,
    max: (c) => rateLimitMax('organization', c),
    key: organizationRateLimitKey,
  },
];

const limiter = rateLimit(apiRateLimitRules);
const rateLimitedRequests = new WeakSet<Request>();

export const apiRateLimit: MiddlewareHandler<AppEnv> = (c: Context<AppEnv>, next: Next) => {
  if (isBatchSubRequest(c)) return next();
  rateLimitedRequests.add(c.req.raw);
  return limiter(c, next);
};

export const chargeAdditionalBatchApiRateLimit = async (
  c: Context<AppEnv>,
  totalRequests: number,
): Promise<void> => {
  if (!rateLimitedRequests.has(c.req.raw)) return;
  const extraCost = batchRateLimitCost(totalRequests) - 1;
  if (extraCost > 0) await enforceRateLimit(c, apiRateLimitRules, { cost: extraCost });
};
