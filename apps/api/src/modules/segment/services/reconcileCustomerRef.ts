/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { applyLens, check } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { withRule } from '@template/shared/rules';
import { resolvedCustomerRefLens } from '#/modules/customerRef/lib/customerRefLens';
import { providerOf, segmentsOf } from '#/modules/segment/lib/segmentOwner';
import { applyMembershipDiff, type MembershipDiff } from '#/modules/segment/services/applyMembershipDiff';
import { type HydratedCustomerRef, hydrateCustomerRefs } from '#/modules/segment/services/hydrateCustomerRefs';
import { isContinuous } from '#/modules/segment/services/reconcileSegment';
import { buildReferenceMap, sortByDependency } from '#/modules/segment/services/segmentReferenceGraph';
import { segmentRuleStates } from '#/modules/segment/services/segmentRuleHealth';

export type CustomerRefReconciliation = { segmentId: string; diff: MembershipDiff }[];

export const dynamicSegmentsOf = (ownerModel: ProviderModel, ownerId: string): Promise<Segment[]> =>
  segmentsOf(ownerModel, ownerId, { type: 'dynamic' });

const recordDecision = (row: HydratedCustomerRef, segment: Segment, matches: boolean): void => {
  const index = row.segmentMembers.findIndex((member) => member.segment?.id === segment.id);
  if (matches && index === -1) row.segmentMembers.push({ segment });
  if (!matches && index !== -1) row.segmentMembers.splice(index, 1);
};

export const reconcileCustomerRef = async (customerRefId: string): Promise<CustomerRefReconciliation> => {
  const customerRef = await db.customerRef.findUnique({ where: { id: customerRefId } });
  if (!customerRef) return [];
  const provider = providerOf(customerRef);

  const segments = (await dynamicSegmentsOf(provider.ownerModel, provider.ownerId)).filter(isContinuous);
  if (!segments.length) return [];

  const [row] = await hydrateCustomerRefs(provider.ownerModel, provider.ownerId, [customerRefId]);
  const lens = resolvedCustomerRefLens(provider.ownerModel, provider.ownerId);
  const ordered = sortByDependency(segments, buildReferenceMap(segments));
  const states = await segmentRuleStates(ordered);

  const results: CustomerRefReconciliation = [];
  for (const segment of ordered) {
    const matches = withRule(states.get(segment.id)!.health, {
      degraded: () => null,
      sound: (rule) => (row ? check(applyLens(rule, lens), row) === true : false),
    });
    if (matches === null) continue;
    if (row) recordDecision(row, segment, matches);
    const diff = await applyMembershipDiff({
      segmentId: segment.id,
      matching: matches ? [customerRefId] : [],
      within: [customerRefId],
    });
    if (diff.added.length || diff.removed.length) results.push({ segmentId: segment.id, diff });
  }
  return results;
};
