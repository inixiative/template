/**
 * @atlas
 * @kind query
 * @partOf feature:segment
 * @uses none
 */
import type { Prisma } from '@template/db';

export const selectSegmentForCustomer = {
  id: true,
  name: true,
  ownerModel: true,
  type: true,
  createdAt: true,
} as const satisfies Prisma.SegmentSelect;

export const includeSegmentForCustomer = {
  segment: { select: selectSegmentForCustomer },
} as const satisfies Prisma.SegmentMemberInclude;
