/**
 * @atlas
 * @kind constant
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import type { ModelTypeMap, Prisma } from '@template/db';
import { cacheKey } from '@template/db';

type CacheReference = { [M in Prisma.ModelName]?: (r: ModelTypeMap[M]) => string[] };

export const cacheReference: CacheReference = {
  User: (r) => [cacheKey('user', r.id), cacheKey('user', { email: r.email })],

  Session: (r) => [cacheKey('session', r.id), cacheKey('session', { userId: r.userId }, [], true)],

  Token: (r) => [cacheKey('token', { keyHash: r.keyHash })],

  Organization: (r) => [cacheKey('organization', r.id), cacheKey('organization', { slug: r.slug })],

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
        case 'User':
          return r.userId;
        case 'Organization':
          return r.organizationId;
      }
    })();
    if (!ownerId) return [];
    return [cacheKey('webhookSubscription', { [r.ownerModel]: ownerId }, [r.model])];
  },
};

export const fetchCacheKeys = (model: Prisma.ModelName, record: Record<string, unknown>): string[] => {
  const fn = cacheReference[model] as ((r: Record<string, unknown>) => string[]) | undefined;
  if (!fn) return [];
  return fn(record);
};
