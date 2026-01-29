import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const respond500 = (c: Context<AppEnv>, error?: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return c.json(
    {
      error: 'Internal Server Error',
      message: errorMessage,
      stack: errorStack,
    },
    500,
  );
};
