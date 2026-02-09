import type { Context } from 'hono';
import type { PublicZodIssue } from '#/middleware/error/types';
import type { AppEnv } from '#/types/appEnv';

export const respond422 = (c: Context<AppEnv>, issues: PublicZodIssue[]) => {
  return c.json(
    {
      error: 'Unprocessable Entity',
      message: 'Validation failed',
      issues,
    },
    422,
  );
};
