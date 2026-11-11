/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, primitive:authz
 * @uses none
 */
import { type Entitlement, Prisma } from '@template/db/generated/client/client';
import { EntitlementTargetModel } from '@template/db/generated/client/enums';
import { type AccessorName, toAccessor } from '@template/db/utils/modelNames';

const ENTITLEMENT_TARGET_ACCESSORS: readonly AccessorName[] =
  Object.values(EntitlementTargetModel).map(toAccessor);

export const isEntitlementTargetAccessor = (accessor: string): boolean =>
  ENTITLEMENT_TARGET_ACCESSORS.includes(accessor as AccessorName);

/** A target's live rows, in the order they were granted. */
export const includeTargetEntitlements = {
  targetEntitlements: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: Prisma.SortOrder.asc }, { id: Prisma.SortOrder.asc }],
  },
};

export type WithTargetEntitlements<T> = T & { targetEntitlements: Entitlement[] };
