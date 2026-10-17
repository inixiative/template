/**
 * @atlas
 * @kind middleware
 * @partOf primitive:errors
 * @uses none
 */
import type { Context } from 'hono';
import type { AppError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const respondAppError = (c: Context<AppEnv>, error: AppError) => {
  const requestId = c.get('requestId') ?? crypto.randomUUID();
  c.header('request-id', requestId);
  error.requestId = requestId;
  const response = error.getResponse();
  return c.newResponse(response.body, response);
};
