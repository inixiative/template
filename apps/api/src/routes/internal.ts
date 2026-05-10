import crypto from 'node:crypto';
import { OpenAPIHono } from '@hono/zod-openapi';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const internalRouter = new OpenAPIHono<AppEnv>();

// HMAC both sides with a transient per-request key so timingSafeEqual
// always operates on equal-length 32-byte digests. A naive length
// pre-check would leak the secret's byte length via timing.
const compareSecret = (provided: string, expected: string): boolean => {
  const key = crypto.randomBytes(32);
  const a = crypto.createHmac('sha256', key).update(provided).digest();
  const b = crypto.createHmac('sha256', key).update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};

internalRouter.use('*', async (c, next) => {
  const provided = c.req.header('x-internal-secret');
  const expected = process.env.INTERNAL_SHARED_SECRET;
  if (!expected) throw makeError({ status: 500, message: 'INTERNAL_SHARED_SECRET not configured' });
  if (!provided || !compareSecret(provided, expected)) {
    throw makeError({ status: 401, message: 'Unauthorized' });
  }
  return next();
});

internalRouter.get('/health', (c) => c.json({ status: 'ok' }));
