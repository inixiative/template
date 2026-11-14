/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses none
 */
import type { CustomerModel } from '@template/db/generated/client/enums';
import type { FlagValue } from '#/modules/featureFlag/lib/zeroFor';
import type { ResolvedFlags } from '#/modules/featureFlag/services/resolveFlags';
import { customerRefCustomerId } from '#/modules/segment/services/publishMembershipChanges';

export type FeatureFlagValue = {
  ownerModel: string;
  ownerId: string;
  customerModel: CustomerModel;
  customerId: string;
  slug: string;
  valueType: string;
  value: FlagValue;
};

/** The subject-facing shape: values only, never a variant label or a rule. */
export const subjectFeatureFlagValues = (resolved: ResolvedFlags): FeatureFlagValue[] =>
  resolved.refs.flatMap((ref) =>
    Object.values(ref.flags).map(({ flag, value }) => ({
      ownerModel: ref.provider.ownerModel,
      ownerId: ref.provider.ownerId,
      customerModel: ref.customerRef.customerModel,
      customerId: customerRefCustomerId(ref.customerRef),
      slug: flag.slug,
      valueType: flag.valueType,
      value,
    })),
  );
