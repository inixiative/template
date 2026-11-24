/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext
 */
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';
import { ipRateLimitKey, userRateLimitKey } from '#/middleware/rateLimit/rateLimitKeys';

export const twoFactorRateLimit = rateLimit([
  {
    scope: 'twoFactor',
    windowMs: 60_000,
    max: (c) => rateLimitMax('twoFactor', c),
    key: ipRateLimitKey,
  },
  {
    scope: 'twoFactor',
    windowMs: 60_000,
    max: (c) => rateLimitMax('twoFactor', c),
    key: userRateLimitKey,
  },
]);
