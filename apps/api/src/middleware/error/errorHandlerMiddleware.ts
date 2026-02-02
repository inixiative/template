import * as Sentry from '@sentry/bun';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@template/db';
import { log } from '@template/shared/logger';
import { ResponseValidationError } from '#/lib/utils/makeController';
import type { AppEnv } from '#/types/appEnv';
import { formatZodIssues } from './formatZodIssues';
import { isZodError } from './isZodError';
import { respond422 } from './respond422';
import { respond500 } from './respond500';

export async function errorHandlerMiddleware(err: unknown, c: Context<AppEnv>) {
  c.header('Cache-Control', 'no-store');

  if (process.env.NODE_ENV === 'test') {
    log.error('Error in handler:', err);
  }

  // Handle Zod validation errors
  if (isZodError(err)) {
    return respond422(c, formatZodIssues(err));
  }

  // Handle response validation errors (controller returned invalid data)
  if (err instanceof ResponseValidationError) {
    log.error('Response validation failed:', err.zodError);
    return respond500(c, err);
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint violation
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'unknown';
      return c.json({ error: 'Already exists', constraint: target }, 409);
    }
    if (err.code === 'P2025') {
      return c.json({ error: 'Not found' }, 404);
    }
  }

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      Sentry.captureException(err, {
        extra: {
          statusCode: err.status,
          path: c.req.path,
          method: c.req.method,
        },
      });
    }
    return c.json({ error: err.message }, err.status);
  }

  // Capture all other errors to Sentry
  if (process.env.NODE_ENV !== 'test') {
    Sentry.captureException(err, {
      extra: {
        path: c.req.path,
        method: c.req.method,
      },
    });
  }

  return respond500(c, err);
}
