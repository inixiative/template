/**
 * @atlas
 * @kind utils
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const isSuperadmin = (c: Context<AppEnv>): boolean => c.get('permix').isSuperadmin();
