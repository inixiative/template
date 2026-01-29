import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';
import type { PublicZodIssue } from './types';

export function respond422(c: Context<AppEnv>, issues: PublicZodIssue[]) {
  return c.json(
    {
      error: 'Unprocessable Entity',
      message: 'Validation failed',
      issues,
    },
    422,
  );
}
