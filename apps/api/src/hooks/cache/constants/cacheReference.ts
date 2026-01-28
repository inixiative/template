import type { ModelTypeMap, Prisma } from '@template/db';
import { cacheKey } from '#/lib/cache';

/**
 * Cache Key Pattern (use cacheKey helper)
 *
 * Format: <Model>:<field>:<value>[:<tags>][:*]
 *
 * Examples:
 *   cacheKey('User', id)                                   → User:id:abc-123
 *   cacheKey('User', email, 'email')                       → User:email:foo@example.com
 *   cacheKey('User', id, 'id', ['OrganizationUsers'])      → User:id:abc-123:OrganizationUsers
 *   cacheKey('Session', userId, 'userId', [], true)        → Session:userId:abc-123:*
 */

type CacheReference = { [M in Prisma.ModelName]?: (r: ModelTypeMap[M]) => string[] };

export const CACHE_REFERENCE: CacheReference = {
  User: (r) => [
    cacheKey('User', r.id),
    cacheKey('User', r.email, 'email'),
  ],

  Session: (r) => [
    cacheKey('Session', r.id),
    cacheKey('Session', r.userId, 'userId', [], true),
  ],

  Token: (r) => [
    cacheKey('Token', r.keyHash, 'keyHash'),
  ],

  OrganizationUser: (r) => [
    cacheKey('OrganizationUser', r.id),
    cacheKey('User', r.userId, 'id', ['OrganizationUsers']),
  ],

  WebhookSubscription: (r) => {
    const ownerId = (() => {
      switch (r.ownerModel) {
        case 'User': return r.userId;
        case 'Organization': return r.organizationId;
      }
    })();
    if (!ownerId) return [];
    return [cacheKey('WebhookSubscription', ownerId, r.ownerModel, [r.model])];
  },
};

export const fetchCacheKeys = (model: Prisma.ModelName, record: Record<string, unknown>): string[] => {
  const fn = CACHE_REFERENCE[model] as ((r: Record<string, unknown>) => string[]) | undefined;
  if (!fn) return [];
  return fn(record);
};
