/**
 * @atlas
 * @kind util
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import type { AppEnv } from '#/types/appEnv';

export const realUserActor = (c: Context<AppEnv>) => c.get('spoofedBy') ?? actingUser(c);
