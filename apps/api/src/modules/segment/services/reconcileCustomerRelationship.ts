/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { check, narrowRule } from '@inixiative/json-rules';
import { db, polymorphicTarget } from '@template/db';
import type { CustomerRelationship, Segment } from '@template/db/generated/client/client';
import { type ProviderModel, SegmentType } from '@template/db/generated/client/enums';
import { withRule } from '@template/shared/rules';
import { ownedSegments } from '#/modules/customerRelationship/lib/ownedSegments';
import { resolvedCustomerRelationshipLens } from '#/modules/customerRelationship/lib/resolvedCustomerRelationshipLens';
import {
  applyMembershipDiff,
  type MembershipDiff,
} from '#/modules/segment/services/applyMembershipDiff';
import {
  type HydratedCustomerRelationship,
  hydrateCustomerRelationships,
} from '#/modules/segment/services/hydrateCustomerRelationships';
import { isContinuous } from '#/modules/segment/services/reconcileSegment';
import {
  buildReferenceMap,
  sortByDependency,
} from '#/modules/segment/services/segmentReferenceGraph';
import { segmentRuleStates } from '#/modules/segment/services/segmentRuleHealth';

export type CustomerRelationshipReconciliation = { segmentId: string; diff: MembershipDiff }[];

const providerOf = (
  customerRelationship: CustomerRelationship,
): { ownerModel: ProviderModel; ownerId: string } | null => {
  const target = polymorphicTarget(customerRelationship, 'CustomerRelationship', 'providerModel');
  return target ? { ownerModel: target.kind as ProviderModel, ownerId: target.id } : null;
};

export const dynamicSegmentsOf = async (
  ownerModel: ProviderModel,
  ownerId: string,
): Promise<Segment[]> =>
  (await ownedSegments(ownerModel, ownerId)).filter(
    (segment) => segment.type === SegmentType.dynamic,
  );

const recordDecision = (
  row: HydratedCustomerRelationship,
  segment: Segment,
  matches: boolean,
): void => {
  const index = row.segmentMembers.findIndex((member) => member.segment?.id === segment.id);
  if (matches && index === -1) row.segmentMembers.push({ segment });
  if (!matches && index !== -1) row.segmentMembers.splice(index, 1);
};

export const reconcileCustomerRelationship = async (
  customerRelationshipId: string,
): Promise<CustomerRelationshipReconciliation> => {
  const customerRelationship = await db.customerRelationship.findUnique({
    where: { id: customerRelationshipId },
  });
  if (!customerRelationship) return [];
  const provider = providerOf(customerRelationship);
  if (!provider) return [];

  const segments = (await dynamicSegmentsOf(provider.ownerModel, provider.ownerId)).filter(
    isContinuous,
  );
  if (!segments.length) return [];

  const lens = resolvedCustomerRelationshipLens(provider.ownerModel, provider.ownerId);
  const ordered = sortByDependency(segments, buildReferenceMap(segments));
  const states = await segmentRuleStates(ordered);
  const [row] = await hydrateCustomerRelationships(provider.ownerModel, provider.ownerId, [
    customerRelationshipId,
  ]);

  const results: CustomerRelationshipReconciliation = [];
  for (const segment of ordered) {
    const matches = withRule(states.get(segment.id)!.health, {
      degraded: () => null,
      sound: (rule) => (row ? check(narrowRule(rule, lens), row) === true : false),
    });
    if (matches === null) continue;
    if (row) recordDecision(row, segment, matches);
    const diff = await applyMembershipDiff({
      segmentId: segment.id,
      matching: matches ? [customerRelationshipId] : [],
      within: [customerRelationshipId],
    });
    if (diff.added.length || diff.removed.length) results.push({ segmentId: segment.id, diff });
  }
  return results;
};
