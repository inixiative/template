import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const respond500 = (c: Context<AppEnv>, error?: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const err = makeError({ status: 500, message: errorMessage });
  err.requestId = c.get('requestId');
  return err.getResponse();
};
