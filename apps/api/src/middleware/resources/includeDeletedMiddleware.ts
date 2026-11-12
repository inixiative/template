/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { MiddlewareHandler } from 'hono';

// A route that declares `includeDeleted` serves soft-deleted rows only when the caller asks with
// `?includeDeleted=true`. Everything after it, the resource lookup included, runs inside
// db.withDeleted. That is the whole request on purpose: a cascade stamps the parent's deletedAt
// onto its children, so unlocking only the lookup would load the target with its children missing.
// Writes may declare it too, because a revive endpoint has to load the tombstone it revives.
// withDeleted nests safely: each call gives its own callback its own value.
export const includeDeletedMiddleware = (): MiddlewareHandler => async (c, next) =>
  c.req.query('includeDeleted') === 'true' ? db.withDeleted(() => next()) : next();
