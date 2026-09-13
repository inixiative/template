/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { applyLens, check } from '@inixiative/json-rules';
import { type Db, db as defaultDb, type RuleReferenceRow } from '@template/db';
import type { CustomerRef, Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { withRule } from '@template/shared/rules';
import { resolvedSegmentLens } from '#/modules/segment/lib/segmentLens';
import { customerRefProviderFk, segmentOwnerFk } from '#/modules/segment/lib/segmentOwner';
import { applyMembershipDiff, type MembershipDiff } from '#/modules/segment/services/applyMembershipDiff';
import { type HydratedCustomerRef, hydrateCustomerRefs } from '#/modules/segment/services/hydrateCustomerRefs';
import { isContinuous } from '#/modules/segment/services/reconcileSegment';
import { buildReferenceMap, sortByDependency } from '#/modules/segment/services/segmentReferenceGraph';
import { segmentRuleHealth } from '#/modules/segment/services/segmentRuleHealth';

export type CustomerRefReconciliation = { segmentId: string; diff: MembershipDiff }[];

const providerOf = (customerRef: CustomerRef): { ownerModel: ProviderModel; ownerId: string } | null => {
  const ownerModel = customerRef.providerModel;
  const ownerId = (customerRef as unknown as Record<string, unknown>)[customerRefProviderFk(ownerModel)] as
    | string
    | null;
  return ownerId ? { ownerModel, ownerId } : null;
};

export const dynamicSegmentsOf = (ownerModel: ProviderModel, ownerId: string, db: Db = defaultDb) =>
  db.segment.findMany({
    where: { ownerModel, [segmentOwnerFk(ownerModel)]: ownerId, deletedAt: null, type: 'dynamic' },
  });

const recordDecision = (row: HydratedCustomerRef, segment: Segment, matches: boolean): void => {
  const index = row.segmentMembers.findIndex((member) => member.segment?.id === segment.id);
  if (matches && index === -1) row.segmentMembers.push({ segment });
  if (!matches && index !== -1) row.segmentMembers.splice(index, 1);
};

export const reconcileCustomerRef = async (
  customerRefId: string,
  db: Db = defaultDb,
): Promise<CustomerRefReconciliation> => {
  const customerRef = await db.customerRef.findUnique({ where: { id: customerRefId } });
  if (!customerRef) return [];
  const provider = providerOf(customerRef);
  if (!provider) return [];

  const segments = (await dynamicSegmentsOf(provider.ownerModel, provider.ownerId, db)).filter(isContinuous);
  if (!segments.length) return [];

  const [row] = await hydrateCustomerRefs(provider.ownerModel, provider.ownerId, [customerRefId], db);
  const lens = resolvedSegmentLens(provider.ownerModel, provider.ownerId);
  const ordered = sortByDependency(segments, buildReferenceMap(segments));
  const edges = (await db.ruleReference.findMany({
    where: { segmentId: { in: ordered.map((segment) => segment.id) } },
  })) as (RuleReferenceRow & { segmentId: string })[];
  const edgesBySegment = new Map<string, RuleReferenceRow[]>();
  for (const edge of edges) edgesBySegment.set(edge.segmentId, [...(edgesBySegment.get(edge.segmentId) ?? []), edge]);

  const results: CustomerRefReconciliation = [];
  for (const segment of ordered) {
    const matches = withRule(segmentRuleHealth(segment, edgesBySegment.get(segment.id) ?? []), {
      degraded: () => null,
      sound: (rule) => (row ? check(applyLens(rule, lens), row) === true : false),
    });
    if (matches === null) continue;
    if (row) recordDecision(row, segment, matches);
    const diff = await applyMembershipDiff(
      { segmentId: segment.id, matching: matches ? [customerRefId] : [], within: [customerRefId] },
      db,
    );
    if (diff.added.length || diff.removed.length) results.push({ segmentId: segment.id, diff });
  }
  return results;
};
