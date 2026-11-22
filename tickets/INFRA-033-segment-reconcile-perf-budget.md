# INFRA-033: Segment reconcile perf budget — measure the DB load, set the threshold for field-level narrowing

**Status**: 📝 Draft
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-09-30
**Updated**: 2026-11-18

> The rule check is cheap; the database calls are the cost. Both reconcile rails re-scan wider than they need to, and Future Flags (FEAT-003) multiplies the segment count with one internal segment per variant. Measure the actual load, find the knee, and write down the scale at which field-level trigger narrowing (FEAT-021's "next cut") must land.

---

## What to measure

- **Customer rail** (`reconcileCustomerRelationshipSegments` → `reconcileCustomerRelationships`): queries per run. One job carries a list of customers; per provider and per page of 500 relationships it hydrates once and applies one membership diff per segment. It still evaluates *every* dynamic segment of the providers (`dynamicSegmentsOf(...).filter(isReconcilableDynamicSegment)`). Count segments evaluated × queries per page at current segment counts, and how many customers a typical job carries.
- **Segment rail** (`reconcileSegment`): set-based, one query per segment via `toPrisma` over the resolved lens, plus junction diff writes. Count queries + write volume per rule change.
- **Sweep** (`reconcileEveryHealthyDynamicSegment`, 04:00 UTC): full pass over sound dynamic segments in dependency order. Cost per night at current scale.
- **Trigger frequency**: events per customer per day across `RECONCILE_TRIGGERS`. The job no longer supersedes (2026-11-18): each event enqueues its own job, and an event that carries many rows (`tag.deleted`) enqueues one job for all of them. Measure how many repeat runs over the same customer burst writes cause. Overlapping runs are not ordered: the job is safe to re-run, and an older run that writes last is corrected by the customer's next change or the nightly sweep (2026-11-18); if that window shows up in practice, order the writes with INFRA-049's generation style.

## The question to answer

At what scale — segments per owner × customers × trigger events per day — does "evaluate all dynamic segments per customer event" exceed the DB budget? State it as a concrete threshold (e.g. above N dynamic segments per provider at M daily trigger events, p99 reconcile latency exceeds S seconds / query volume exceeds Q per minute).

## Then decide

- **Near or far?** Project with flag-internal segments included (FEAT-003: one internal segment per variant — the segment count is about to grow).
- **If near:** build FEAT-021's field-level trigger narrowing — record the lens paths each segment reads at save time (next to the INFRA-030 edges), intersect with the changed columns carried by the event — plus the reach-set delta (skip segments whose rule never reads the changed model; hydrate only what the survivors read).
- **If far:** keep the measurement as the standing perf harness and re-run when segment counts 10x.

## References

- FEAT-021 (segments; "Field-level trigger narrowing" and "Reach-set delta" open items)
- INFRA-030 (reference registry — the derive-at-save precedent)
- FEAT-003 (future flags — the segment-count multiplier)
- `apps/api/src/modules/segment/services/reconcileCustomerRelationships.ts`
- `apps/api/src/modules/segment/lib/enqueueSegmentReconcileForCustomers.ts`
- `apps/api/src/jobs/handlers/reconcileCustomerRelationshipSegments.ts`
- `apps/api/src/modules/segment/lib/reconcileTriggers.ts`
