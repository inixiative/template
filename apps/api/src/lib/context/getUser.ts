import type { User } from '@template/db';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export const getUser = (c: Context<AppEnv>): User | null => c.get('user');
