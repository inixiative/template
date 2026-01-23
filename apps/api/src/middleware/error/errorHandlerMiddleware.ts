import * as Sentry from '@sentry/bun';
import { formatZodIssues } from './formatZodIssues';
import { isZodError } from './isZodError';
import { respond422 } from './respond422';
import { respond500 } from './respond500';
import type { AppEnv } from '@src/types/appEnv';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export async function errorHandlerMiddleware(err: unknown, c: Context<AppEnv>) {
  if (process.env.NODE_ENV === 'test') {
    console.error('Error in handler:', err);
  }

  // Handle Zod validation errors
  if (isZodError(err)) {
    return respond422(c, formatZodIssues(err));
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
    c.header('Cache-Control', 'no-store');
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
