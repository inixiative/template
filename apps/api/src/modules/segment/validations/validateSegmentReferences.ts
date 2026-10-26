/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { ownedSegments } from '#/modules/customerRef/lib/ownedSegments';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import {
  buildReferenceMap,
  findReferenceCycle,
} from '#/modules/segment/services/segmentReferenceGraph';

type Owner = { ownerModel: ProviderModel } & Record<string, unknown>;

const assertNoReferenceCycle = (candidate: Segment, owned: Segment[]): void => {
  const others = owned.filter((segment) => segment.id !== candidate.id);
  const cycle = findReferenceCycle(buildReferenceMap([candidate, ...others]), candidate.id);
  if (cycle) {
    throw makeError({
      status: 422,
      message: `Invalid segment conditions: membership references form a loop: ${cycle.join(' -> ')}`,
    });
  }
};

export const validateSegmentReferences = async (
  owner: Owner,
  conditions: Condition,
  previous?: Segment,
): Promise<void> => {
  if (!previous) return;
  const owned = await ownedSegments(owner.ownerModel, segmentOwnerId(owner as Segment));
  assertNoReferenceCycle({ ...previous, conditions: conditions as Segment['conditions'] }, owned);
};
