/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, primitive:authz
 * @uses none
 */
import { type Entitlement, Prisma } from '@template/db/generated/client/client';
import { EntitlementTargetModel } from '@template/db/generated/client/enums';
import { type AccessorName, toAccessor, toModelName } from '@template/db/utils/modelNames';

const ENTITLEMENT_TARGET_ACCESSORS: readonly AccessorName[] =
  Object.values(EntitlementTargetModel).map(toAccessor);

export const isEntitlementTargetAccessor = (accessor: string): boolean =>
  ENTITLEMENT_TARGET_ACCESSORS.includes(accessor as AccessorName);

export const entitlementTargetModelOf = (accessor: string): EntitlementTargetModel =>
  toModelName(accessor) as EntitlementTargetModel;

// why: a member arm keys on the owner chain, so an OrganizationUser's relation also reaches its SpaceUser rows.
/** A target's live rows, in the order they were granted. */
export const includeTargetEntitlements = <M extends EntitlementTargetModel>(targetModel: M) => ({
  targetEntitlements: {
    where: { deletedAt: null, targetModel },
    orderBy: [{ createdAt: Prisma.SortOrder.asc }, { id: Prisma.SortOrder.asc }],
  },
});

export type IncludeTargetEntitlements = ReturnType<typeof includeTargetEntitlements>;

export type WithTargetEntitlements<T> = T & { targetEntitlements: Entitlement[] };
