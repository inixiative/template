import type { ModelTypeMap, Prisma } from '@template/db';
import { cacheKey } from '@template/db';

/**
 * Cache Key Pattern (use cacheKey helper)
 *
 * Format: cache:<accessor>:<field>:<value>[:<field>:<value>...][:<tags>][:*]
 * Composite keys are sorted alphabetically for consistency.
 *
 * Examples:
 *   cacheKey('user', id)                                              → cache:user:id:abc-123
 *   cacheKey('user', { email })                                       → cache:user:email:foo@example.com
 *   cacheKey('user', id, ['organizationUsers'])                       → cache:user:id:abc-123:organizationUsers
 *   cacheKey('session', { userId }, [], true)                         → cache:session:userId:abc-123:*
 *   cacheKey('organizationUser', { userId, organizationId })          → cache:organizationUser:organizationId:o1:userId:u1
 */

type CacheReference = { [M in Prisma.ModelName]?: (r: ModelTypeMap[M]) => string[] };

export const CACHE_REFERENCE: CacheReference = {
  User: (r) => [
    cacheKey('user', r.id),
    cacheKey('user', { email: r.email }),
  ],

  Session: (r) => [
    cacheKey('session', r.id),
    cacheKey('session', { userId: r.userId }, [], true),
  ],

  Token: (r) => [
    cacheKey('token', { keyHash: r.keyHash }),
  ],

  Organization: (r) => [
    cacheKey('organization', r.id),
    cacheKey('organization', { slug: r.slug }),
  ],

  OrganizationUser: (r) => [
    cacheKey('organizationUser', { organizationId: r.organizationId, userId: r.userId }),
    cacheKey('user', r.userId, ['organizationUsers']),
  ],

  Space: (r) => [
    cacheKey('space', r.id),
    cacheKey('space', { organizationId: r.organizationId, slug: r.slug }),
    cacheKey('organization', r.organizationId, ['spaces']),
  ],

  SpaceUser: (r) => [
    cacheKey('spaceUser', { spaceId: r.spaceId, userId: r.userId }),
    cacheKey('user', r.userId, ['spaceUsers']),
    cacheKey('space', r.spaceId, ['spaceUsers']),
  ],

  CustomerRef: (r) => {
    const keys: string[] = [cacheKey('customerRef', r.id)];
    if (r.customerUserId) keys.push(cacheKey('user', r.customerUserId, ['customerRefs']));
    if (r.customerOrganizationId) keys.push(cacheKey('organization', r.customerOrganizationId, ['customerRefs']));
    if (r.customerSpaceId) keys.push(cacheKey('space', r.customerSpaceId, ['customerRefs']));
    if (r.providerSpaceId) keys.push(cacheKey('space', r.providerSpaceId, ['providerRefs']));
    return keys;
  },

  WebhookSubscription: (r) => {
    const ownerId = (() => {
      switch (r.ownerModel) {
        case 'User': return r.userId;
        case 'Organization': return r.organizationId;
      }
    })();
    if (!ownerId) return [];
    return [cacheKey('webhookSubscription', { [r.ownerModel]: ownerId }, [r.model])];
  },
};

export const fetchCacheKeys = (model: Prisma.ModelName, record: Record<string, unknown>): string[] => {
  const fn = CACHE_REFERENCE[model] as ((r: Record<string, unknown>) => string[]) | undefined;
  if (!fn) return [];
  return fn(record);
};
