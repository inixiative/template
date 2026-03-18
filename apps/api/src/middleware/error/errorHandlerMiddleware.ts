import { Prisma } from '@template/db';
import { log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { errorReporter } from '#/lib/errorReporter';
import { AppError, makeError } from '#/lib/errors';
import { ResponseValidationError } from '#/lib/utils/makeController';
import { formatZodIssues } from '#/middleware/error/formatZodIssues';
import { isZodError } from '#/middleware/error/isZodError';
import { respond422 } from '#/middleware/error/respond422';
import { respond500 } from '#/middleware/error/respond500';
import type { AppEnv } from '#/types/appEnv';

export const errorHandlerMiddleware = async (err: unknown, c: Context<AppEnv>) => {
  c.header('Cache-Control', 'no-store');

  if (isZodError(err)) {
    return respond422(c, formatZodIssues(err));
  }

  if (err instanceof ResponseValidationError) {
    log.error('Response validation failed:', err.zodError);
    return respond500(c, err);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return makeError({ status: 400, message: 'Invalid query parameters' }).getResponse();
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'unknown';
      return makeError({ status: 409, message: `Resource already exists: ${target}` }).getResponse();
    }
    if (err.code === 'P2025') return makeError({ status: 404, message: 'Resource not found' }).getResponse();
  }

  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      errorReporter.captureException(err, { extra: { statusCode: err.status, path: c.req.path, method: c.req.method } });
      if (isTest) log.error('Error in handler:', err);
      if (err instanceof AppError) err.requestId = c.get('requestId');
    }
    return err.getResponse();
  }

  errorReporter.captureException(err, { extra: { path: c.req.path, method: c.req.method } });
  return respond500(c, err);
};
