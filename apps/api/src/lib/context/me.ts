/**
 * @atlas
 * @kind helper
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const me = (c: Context<AppEnv>) => c.get('user') ?? c.get('token')?.user ?? null;
