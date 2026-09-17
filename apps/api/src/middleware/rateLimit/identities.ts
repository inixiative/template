/**
 * @atlas
 * @kind helper
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import { clientIp } from '#/lib/clientIp';
import { getActor } from '#/lib/context/getActor';
import type { AppEnv } from '#/types/appEnv';

export const ipIdentity = (c: Context<AppEnv>): string => `ip:${clientIp(c)}`;

// A session and every token owned by or through the user share one bucket: minting tokens buys nothing.
export const userIdentity = (c: Context<AppEnv>): string | null => {
  const { user } = getActor(c);
  return user ? `user:${user.id}` : null;
};

export const principalIdentity = (c: Context<AppEnv>): string => userIdentity(c) ?? ipIdentity(c);

export const organizationIdentity = (c: Context<AppEnv>): string | null => {
  const { organization } = getActor(c);
  return organization ? `organization:${organization.id}` : null;
};

export const spaceIdentity = (c: Context<AppEnv>): string | null => {
  const { space } = getActor(c);
  return space ? `space:${space.id}` : null;
};
