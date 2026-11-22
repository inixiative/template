/**
 * @atlas
 * @kind utils
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import { clientRateLimitBucketAddress } from '#/lib/clientAddress';
import type { AppEnv } from '#/types/appEnv';

export type RateLimitBucket = 'ip' | 'user' | 'organization' | 'space' | 'global';

export type RateLimitKey = `${RateLimitBucket}:${string}`;

export const rateLimitKey = (bucket: RateLimitBucket, id: string): RateLimitKey =>
  `${bucket}:${id}`;

export const globalRateLimitKey = (): RateLimitKey => rateLimitKey('global', 'all');

export const ipRateLimitKey = (c: Context<AppEnv>): RateLimitKey =>
  rateLimitKey('ip', clientRateLimitBucketAddress(c));

// A user's JWT and every token owned by or through the user share one bucket: minting tokens buys nothing.
export const userRateLimitKey = (c: Context<AppEnv>): RateLimitKey | null => {
  const userId = c.get('user')?.id ?? c.get('token')?.userId;
  return userId ? rateLimitKey('user', userId) : null;
};

export const principalRateLimitKey = (c: Context<AppEnv>): RateLimitKey =>
  userRateLimitKey(c) ?? ipRateLimitKey(c);

export const organizationRateLimitKey = (c: Context<AppEnv>): RateLimitKey | null => {
  const organizationId = c.get('token')?.organizationId;
  return organizationId ? rateLimitKey('organization', organizationId) : null;
};

export const spaceRateLimitKey = (c: Context<AppEnv>): RateLimitKey | null => {
  const spaceId = c.get('token')?.spaceId;
  return spaceId ? rateLimitKey('space', spaceId) : null;
};
