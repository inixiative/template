import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const respond500 = (c: Context<AppEnv>, error?: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const requestId = c.get('requestId') as string;

  return makeError({
    status: 500,
    message: errorMessage,
    requestId,
  }).getResponse();
};
