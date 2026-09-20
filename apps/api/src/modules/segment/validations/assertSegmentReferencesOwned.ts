/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { type Db, db as defaultDb } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { invalidSegmentConditions } from '#/modules/segment/lib/invalidSegmentConditions';
import { segmentLens } from '#/modules/segment/lib/segmentLens';
import { segmentOwnerFk } from '#/modules/segment/lib/segmentOwner';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';

type Candidate = {
  ownerModel: ProviderModel;
  ownerId: string;
  conditions: Condition;
  held?: string[];
};

export const assertSegmentReferencesOwned = async (
  { ownerModel, ownerId, conditions, held = [] }: Candidate,
  db: Db = defaultDb,
): Promise<Segment[]> => {
  const ids = segmentReferences(conditions, segmentLens);
  if (!ids.length) return [];
  const owned = await db.segment.findMany({
    where: { ownerModel, [segmentOwnerFk(ownerModel)]: ownerId, deletedAt: null },
  });
  const found = new Set(owned.map((segment) => segment.id));
  const missing = ids.filter((id) => !found.has(id) && !held.includes(id));
  if (missing.length) {
    throw invalidSegmentConditions([`references a segment this ${ownerModel} does not own: ${missing.join(', ')}`]);
  }
  return owned;
};
