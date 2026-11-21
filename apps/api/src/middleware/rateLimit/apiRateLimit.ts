/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext, primitive:batch
 */
import type { Context, MiddlewareHandler, Next } from 'hono';
import { isBatchSubRequest } from '#/lib/context/isBatchSubRequest';
import { isSystemProbe } from '#/lib/utils/authProbe';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';
import {
  organizationRateLimitKey,
  principalRateLimitKey,
  spaceRateLimitKey,
} from '#/middleware/rateLimit/rateLimitKeys';
import type { AppEnv } from '#/types/appEnv';

const limiter = rateLimit([
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
]);

// Server-initiated re-authorization probes spend no caller budget; client-driven probes and reads still do.
export const apiRateLimit: MiddlewareHandler<AppEnv> = (c: Context<AppEnv>, next: Next) =>
  isBatchSubRequest(c) || isSystemProbe(c) ? next() : limiter(c, next);
