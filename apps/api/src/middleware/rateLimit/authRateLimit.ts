/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext
 */
import { ipIdentity } from '#/middleware/rateLimit/identities';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';

export const authRateLimit = rateLimit([
  { scope: 'auth', windowMs: 60_000, max: (c) => rateLimitMax('auth', c), key: ipIdentity },
]);
