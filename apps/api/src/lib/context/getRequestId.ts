import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const getRequestId = (c: Context<AppEnv>): string => c.get('requestId');
