import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

type ValidatableContext = { valid: (key: string) => unknown };

export const getValidatedBody = <T = Record<string, unknown>>(c: Context<AppEnv>): T =>
  (c.req as unknown as ValidatableContext).valid('json') as T;

export const getValidatedQuery = <T = Record<string, unknown>>(c: Context<AppEnv>): T =>
  (c.req as unknown as ValidatableContext).valid('query') as T;
