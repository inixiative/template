/**
 * @atlas
 * @kind middleware
 * @partOf primitive:errors
 * @uses none
 */
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { respondAppError } from '#/middleware/error/respondAppError';
import type { AppEnv } from '#/types/appEnv';

export const respond500 = (c: Context<AppEnv>, error?: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return respondAppError(c, makeError({ status: 500, message: errorMessage }));
};
