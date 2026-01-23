import type { Prisma } from '../generated/client/client';

/**
 * Cache Reference Mapping
 *
 * Defines which cache keys should be invalidated when a model is mutated.
 * Keys can include wildcards (*) for pattern matching.
 *
 * @example
 * // When a User is updated, clear their profile and any user lists
 * User: (record) => [`users:${record.id}`, `users:email:${record.email}`]
 */

type CacheKeyFn = (record: any) => string[];

export const cacheReference: Partial<Record<Prisma.ModelName, CacheKeyFn>> = {
  // Users & Auth
  User: (record) => [
    `users:${record.id}`,
    `users:email:${record.email}`,
  ],

  Session: (record) => [
    `sessions:${record.id}`,
    `sessions:userId:${record.userId}*`,
  ],

  Wallet: (record) => [
    `wallets:${record.id}`,
    `wallets:userId:${record.userId}*`,
    `wallets:address:${record.address}`,
  ],

  // Webhooks
  WebhookSubscription: (record) => [
    `webhooks:ownerType:${record.ownerType}:ownerId:${record.ownerId}:model:${record.model}`,
    `webhooks:ownerId:${record.ownerId}*`,
  ],

  // Future models - add cache keys as they're implemented
  // Pool: (record) => [`pools:${record.id}`, `pools:slug:${record.slug}`],
  // Investment: (record) => [`investments:${record.id}`, `investments:poolId:${record.poolId}*`],
  // Phase: (record) => [`phases:${record.id}`, `phases:poolId:${record.poolId}*`],
};

/**
 * Get cache keys to invalidate for a given model and record.
 */
export function fetchCacheKeys(model: Prisma.ModelName, record: any): string[] {
  const fn = cacheReference[model];
  if (!fn) return [];
  return fn(record);
}
