/**
 * @atlas
 * @kind helper
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma
 */
import { polymorphicTarget } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';

type OwnerColumns = { ownerModel: ProviderModel } & Record<string, unknown>;

export const featureFlagOwnerIdOf = (flag: OwnerColumns): string =>
  polymorphicTarget(flag, 'FeatureFlag', 'ownerModel')?.id ?? flag.ownerModel;
