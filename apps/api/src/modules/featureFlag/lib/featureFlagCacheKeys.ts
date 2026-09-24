/**
 * @atlas
 * @kind helper
 * @partOf feature:featureFlag
 * @uses primitive:caching
 */
import { cacheKey, polymorphicTarget } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';

type OwnerColumns = { ownerModel: ProviderModel } & Record<string, unknown>;

export const ownerFeatureFlagsKey = (ownerModel: ProviderModel, ownerId: string): string =>
  cacheKey(ownerModel === 'platform' ? 'platform' : ownerModel, ownerId, ['featureFlags']);

export const featureFlagOwnerKeyOf = (flag: OwnerColumns): string => {
  const target = polymorphicTarget(flag, 'FeatureFlag', 'ownerModel');
  return ownerFeatureFlagsKey(flag.ownerModel, target?.id ?? flag.ownerModel);
};

export const featureFlagVariantsKey = (featureFlagId: string): string =>
  cacheKey('featureFlag', featureFlagId, ['variants']);

export const customerRefSegmentMembersKey = (customerRefId: string): string =>
  cacheKey('customerRef', customerRefId, ['segmentMembers']);
