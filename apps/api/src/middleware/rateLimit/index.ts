/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 */
import { ipIdentity, organizationIdentity, principalIdentity, spaceIdentity } from '#/middleware/rateLimit/identities';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';

export {
  ipIdentity,
  organizationIdentity,
  principalIdentity,
  spaceIdentity,
  userIdentity,
} from '#/middleware/rateLimit/identities';
export { type RateLimitTier, rateLimitMax } from '#/middleware/rateLimit/limits';
export { type RateLimitOptions, type RateLimitRule, rateLimit } from '#/middleware/rateLimit/rateLimit';

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

export const authRateLimit = rateLimit([
  { scope: 'auth', windowMs: 60_000, max: (c) => rateLimitMax('auth', c), key: ipIdentity },
]);
