/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { check, narrowRule } from '@inixiative/json-rules';
import type { CustomerRelationship, Segment } from '@template/db/generated/client/client';
import { type ProviderModel, SegmentType } from '@template/db/generated/client/enums';
import { branchOnRuleHealth } from '@template/shared/rules';
import { chunk, groupBy } from 'lodash-es';
import {
  type ProviderSide,
  providerSideOfCustomerRelationship,
} from '#/modules/customerRelationship/lib/customerRelationshipSides';
import { ownedSegments } from '#/modules/customerRelationship/lib/ownedSegments';
import { resolvedCustomerRelationshipLens } from '#/modules/customerRelationship/lib/resolvedCustomerRelationshipLens';
import { applyMembershipDiff } from '#/modules/segment/services/applyMembershipDiff';
import {
  type HydratedCustomerRelationship,
  hydrateCustomerRelationships,
} from '#/modules/segment/services/hydrateCustomerRelationships';
import type { MembershipChange } from '#/modules/segment/services/publishMembershipChanges';
import { isReconcilableDynamicSegment } from '#/modules/segment/services/reconcileSegment';
import {
  sortByDependency,
  targetSegmentIdsBySegmentId,
} from '#/modules/segment/services/segmentReferenceGraph';
import { segmentRuleStates } from '#/modules/segment/services/segmentRuleHealth';

const PAGE_SIZE = 500;

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

const customerRelationshipIdsByProvider = (
  customerRelationships: CustomerRelationship[],
): (ProviderSide & { ids: string[] })[] => {
  const withProvider = customerRelationships.flatMap((customerRelationship) => {
    const provider = providerSideOfCustomerRelationship(customerRelationship);
    return provider ? [{ provider, id: customerRelationship.id }] : [];
  });
  return Object.values(
    groupBy(withProvider, ({ provider }) => `${provider.providerModel}:${provider.providerId}`),
  ).map((group) => ({ ...group[0]!.provider, ids: group.map(({ id }) => id) }));
};

const reconcileProviderPage = async (
  ownerModel: ProviderModel,
  ownerId: string,
  ordered: Segment[],
  states: Awaited<ReturnType<typeof segmentRuleStates>>,
  ids: string[],
): Promise<MembershipChange[]> => {
  const lens = resolvedCustomerRelationshipLens(ownerModel, ownerId);
  const rows = await hydrateCustomerRelationships(ownerModel, ownerId, ids);
  const changes: MembershipChange[] = [];
  for (const segment of ordered) {
    const rule = branchOnRuleHealth(states.get(segment.id)!.health, {
      degraded: () => null,
      sound: (soundRule) => narrowRule(soundRule, lens),
    });
    if (rule === null) continue;
    const matching: string[] = [];
    for (const row of rows) {
      const matches = check(rule, row) === true;
      recordDecision(row, segment, matches);
      if (matches) matching.push(row.id);
    }
    const diff = await applyMembershipDiff({ segmentId: segment.id, matching, within: ids });
    if (diff.added.length || diff.removed.length) changes.push({ segment, diff });
  }
  return changes;
};

export const reconcileCustomerRelationships = async (
  customerRelationships: CustomerRelationship[],
): Promise<MembershipChange[]> => {
  const changes: MembershipChange[] = [];
  for (const {
    providerModel: ownerModel,
    providerId: ownerId,
    ids,
  } of customerRelationshipIdsByProvider(customerRelationships)) {
    const segments = (await dynamicSegmentsOf(ownerModel, ownerId)).filter(
      isReconcilableDynamicSegment,
    );
    if (!segments.length) continue;
    const ordered = sortByDependency(segments, targetSegmentIdsBySegmentId(segments));
    const states = await segmentRuleStates(ordered);
    for (const page of chunk(ids, PAGE_SIZE))
      changes.push(...(await reconcileProviderPage(ownerModel, ownerId, ordered, states, page)));
  }
  return changes;
};
