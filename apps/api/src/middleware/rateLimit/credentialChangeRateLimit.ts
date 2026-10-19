/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext
 */
import { userIdentity } from '#/middleware/rateLimit/identities';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';

// why: per IP alone, a stolen JWT could guess the current password from rotating addresses
export const credentialChangeRateLimit = rateLimit([
  {
    scope: 'credentialChange',
    windowMs: 60_000,
    max: (c) => rateLimitMax('credentialChange', c),
    key: userIdentity,
  },
]);
