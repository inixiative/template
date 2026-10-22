/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import {
  entitlementEntries,
  normalizeEntitlements,
  type Permix,
  resolveSelfKeys,
  type SelfIds,
} from '@template/permissions';

type Placement = { ownerKey: string; selfIds: SelfIds };

export const setupEntitlements = async (
  permix: Permix,
  entitlements: unknown,
  { ownerKey, selfIds }: Placement,
) => {
  const keyed = normalizeEntitlements(entitlements, ownerKey);
  await permix.setup(entitlementEntries(resolveSelfKeys(keyed, selfIds)));
};
