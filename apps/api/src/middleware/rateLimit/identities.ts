/**
 * @atlas
 * @kind helper
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import { clientIp } from '#/lib/clientIp';
import type { AppEnv } from '#/types/appEnv';

export const ipIdentity = (c: Context<AppEnv>): string => `ip:${clientIp(c)}`;

// A user's JWT and every token owned by or through the user share one bucket: minting tokens buys nothing.
export const userIdentity = (c: Context<AppEnv>): string | null => {
  const userId = c.get('user')?.id ?? c.get('token')?.userId;
  return userId ? `user:${userId}` : null;
};

export const principalIdentity = (c: Context<AppEnv>): string => userIdentity(c) ?? ipIdentity(c);

export const organizationIdentity = (c: Context<AppEnv>): string | null => {
  const organizationId = c.get('token')?.organizationId;
  return organizationId ? `organization:${organizationId}` : null;
};

export const spaceIdentity = (c: Context<AppEnv>): string | null => {
  const spaceId = c.get('token')?.spaceId;
  return spaceId ? `space:${spaceId}` : null;
};
