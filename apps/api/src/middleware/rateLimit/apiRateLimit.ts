/**
 * @atlas
 * @kind middleware
 * @partOf infrastructure:redis
 * @uses primitive:requestContext, primitive:batch
 */
import type { Context, MiddlewareHandler, Next } from 'hono';
import { organizationIdentity, principalIdentity, spaceIdentity } from '#/middleware/rateLimit/identities';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';
import type { AppEnv } from '#/types/appEnv';

const limiter = rateLimit([
  { scope: 'api:principal', windowMs: 1_000, max: (c) => rateLimitMax('user', c), key: principalIdentity },
  { scope: 'api:space', windowMs: 1_000, max: (c) => rateLimitMax('space', c), key: spaceIdentity },
  {
    scope: 'api:organization',
    windowMs: 1_000,
    max: (c) => rateLimitMax('organization', c),
    key: organizationIdentity,
  },
]);

// A batch's sub-requests were paid for by the batch request. The x-batch-id header alone is spoofable; the
// transaction prepareRequest resolves from the batch registry is not.
const isBatchSubRequest = (c: Context<AppEnv>): boolean => c.get('txn') !== undefined;

export const apiRateLimit: MiddlewareHandler<AppEnv> = (c: Context<AppEnv>, next: Next) =>
  isBatchSubRequest(c) ? next() : limiter(c, next);
