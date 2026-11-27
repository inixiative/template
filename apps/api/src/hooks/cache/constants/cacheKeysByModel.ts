/**
 * @atlas
 * @kind constant
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import type { ModelTypeMap, Prisma } from '@template/db';
import { cacheKey } from '@template/db';
import { ownerRootCacheKey } from '#/modules/artifact/services/artifactOwner';

type CacheKeysByModel = { [M in Prisma.ModelName]?: (r: ModelTypeMap[M]) => string[] };

export const cacheKeysByModel: CacheKeysByModel = {
  User: (r) => [cacheKey('user', r.id), cacheKey('user', { email: r.email })],

  Token: (r) => [cacheKey('token', { keyHash: r.keyHash }), cacheKey('token', r.id)],

  Integration: (r) => [cacheKey('integration', r.id)],

  Artifact: (r) => [
    cacheKey('artifact', r.id),
    ...(r.kind === 'root' ? [ownerRootCacheKey(r)] : []),
  ],

  Setting: (r) => [
    cacheKey('setting', r.id),
    cacheKey('setting', { resourceModel: r.resourceModel, resourceId: r.resourceId }),
  ],

  Organization: (r) => [cacheKey('organization', r.id), cacheKey('organization', { slug: r.slug })],

  OrganizationUser: (r) => [
    cacheKey('organizationUser', r.id),
    cacheKey('organizationUser', { organizationId: r.organizationId, userId: r.userId }),
    cacheKey('user', r.userId, ['organizationUsers']),
  ],

  Space: (r) => [
    cacheKey('space', r.id),
    cacheKey('space', { organizationId: r.organizationId, id: r.id }),
    cacheKey('space', { organizationId: r.organizationId, slug: r.slug }),
    cacheKey('organization', r.organizationId, ['spaces']),
  ],

  SpaceUser: (r) => [
    cacheKey('spaceUser', r.id),
    cacheKey('spaceUser', {
      organizationId: r.organizationId,
      spaceId: r.spaceId,
      userId: r.userId,
    }),
    cacheKey('user', r.userId, ['spaceUsers']),
    cacheKey('space', r.spaceId, ['spaceUsers']),
  ],

  CustomerRelationship: (r) => {
    const keys: string[] = [cacheKey('customerRelationship', r.id)];
    if (r.customerUserId)
      keys.push(cacheKey('user', r.customerUserId, ['customerRelationshipsAsCustomer']));
    if (r.customerOrganizationId)
      keys.push(
        cacheKey('organization', r.customerOrganizationId, ['customerRelationshipsAsCustomer']),
      );
    if (r.customerSpaceId)
      keys.push(cacheKey('space', r.customerSpaceId, ['customerRelationshipsAsCustomer']));
    if (r.providerUserId)
      keys.push(cacheKey('user', r.providerUserId, ['customerRelationshipsAsProvider']));
    if (r.providerOrganizationId)
      keys.push(
        cacheKey('organization', r.providerOrganizationId, ['customerRelationshipsAsProvider']),
      );
    if (r.providerSpaceId)
      keys.push(cacheKey('space', r.providerSpaceId, ['customerRelationshipsAsProvider']));
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
    return [cacheKey('webhookSubscription', { [r.ownerModel]: ownerId }, [r.resourceModel])];
  },
};

export const cacheKeysForRecord = (
  model: Prisma.ModelName,
  record: Record<string, unknown>,
): string[] => {
  const fn = cacheKeysByModel[model] as ((r: Record<string, unknown>) => string[]) | undefined;
  if (!fn) return [];
  return fn(record);
};
