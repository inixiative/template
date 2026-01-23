import type { PublicZodIssue } from './types';
import type { AppEnv } from '@src/types/appEnv';
import type { Context } from 'hono';

export function respond422(c: Context<AppEnv>, issues: PublicZodIssue[]) {
  c.header('Cache-Control', 'no-store');

  return c.json(
    {
      error: 'Unprocessable Entity',
      message: 'Validation failed',
      issues,
    },
    422,
  );
}
