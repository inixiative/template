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
import { segmentLens } from '#/modules/segment/lib/segmentLens';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { buildReferenceMap, findReferenceCycle } from '#/modules/segment/services/segmentReferenceGraph';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';
import { assertSegmentReferencesOwned } from '#/modules/segment/validations/assertSegmentReferencesOwned';

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
  const lens = segmentLens;
  const owned = await assertSegmentReferencesOwned({
    ownerModel: owner.ownerModel,
    ownerId: segmentOwnerId(owner as Segment),
    conditions,
    held: previous ? segmentReferences(previous.conditions as Condition, lens) : [],
  });
  if (previous) assertNoReferenceCycle({ ...previous, conditions: conditions as Segment['conditions'] }, owned);
};
