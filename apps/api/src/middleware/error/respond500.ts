import { env } from '@src/config/env';
import type { AppEnv } from '@src/types/appEnv';
import type { Context } from 'hono';

export function respond500(c: Context<AppEnv>, error?: unknown) {
  c.header('Cache-Control', 'no-store');

  // Show full error details in non-production environments for debugging
  const showDetails = env.ENVIRONMENT !== 'production';

  if (showDetails && error) {
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
  }

  // Production: hide error details
  return c.json(
    {
      error: 'Internal Server Error',
      message: 'Something went wrong',
    },
    500,
  );
}
