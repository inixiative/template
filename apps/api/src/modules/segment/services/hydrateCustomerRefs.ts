/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type LensNarrowing, Operator } from '@inixiative/json-rules';
import { type Db, db as defaultDb } from '@template/db';
import type { SegmentMemberSource, SegmentOwnerModel } from '@template/db/generated/client/enums';
import { fetchLens } from '@template/db/hydrate/fetchLens';
import { resolvedSegmentLens } from '#/modules/segment/lib/segmentLens';

export type HydratedCustomerRef = Record<string, unknown> & {
  id: string;
  segmentMembers: { source: SegmentMemberSource; segment: (Record<string, unknown> & { id: string }) | null }[];
};

export const hydrateCustomerRefs = async (
  ownerModel: SegmentOwnerModel,
  ownerId: string,
  customerRefIds: string[],
  db: Db = defaultDb,
): Promise<HydratedCustomerRef[]> => {
  if (!customerRefIds.length) return [];
  const lens: LensNarrowing = {
    parent: resolvedSegmentLens(ownerModel, ownerId),
    root: { where: { field: 'id', operator: Operator.in, value: customerRefIds } },
  };
  return fetchLens<HydratedCustomerRef>(db, lens);
};
