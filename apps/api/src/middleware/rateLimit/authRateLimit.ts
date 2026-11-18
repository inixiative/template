/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext
 */

import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';
import { ipRateLimitKey } from '#/middleware/rateLimit/rateLimitKeys';

export const authRateLimit = rateLimit([
  { scope: 'auth', windowMs: 60_000, max: (c) => rateLimitMax('auth', c), key: ipRateLimitKey },
]);
