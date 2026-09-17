/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext
 */
import { organizationIdentity, principalIdentity, spaceIdentity } from '#/middleware/rateLimit/identities';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';

export const apiRateLimit = rateLimit([
  { scope: 'api:principal', windowMs: 1_000, max: (c) => rateLimitMax('user', c), key: principalIdentity },
  { scope: 'api:space', windowMs: 1_000, max: (c) => rateLimitMax('space', c), key: spaceIdentity },
  {
    scope: 'api:organization',
    windowMs: 1_000,
    max: (c) => rateLimitMax('organization', c),
    key: organizationIdentity,
  },
]);
