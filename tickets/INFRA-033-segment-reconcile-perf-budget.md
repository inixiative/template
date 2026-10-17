# INFRA-033: Segment reconcile perf budget — measure the DB load, set the threshold for field-level narrowing

**Status**: 📝 Draft
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-09-30
**Updated**: 2026-09-30

> The rule check is cheap; the database calls are the cost. Both reconcile rails re-scan wider than they need to, and Future Flags (FEAT-003) multiplies the segment count with one internal segment per variant. Measure the actual load, find the knee, and write down the scale at which field-level trigger narrowing (FEAT-021's "next cut") must land.

---

## What to measure

- **Customer rail** (`reconcileCustomerRefSegments` → `reconcileCustomerRef`): queries per run. Today it evaluates *every* dynamic segment of the customer's providers (`dynamicSegmentsOf(...).filter(isContinuous)`) and runs `check()` per segment over one hydrated ref. Count segments evaluated × queries per evaluation at current segment counts.
- **Segment rail** (`reconcileSegment`): set-based, one query per segment via `toPrisma` over the resolved lens, plus junction diff writes. Count queries + write volume per rule change.
- **Sweep** (`sweepSegments`, 04:00 UTC): full pass over sound dynamic segments in dependency order. Cost per night at current scale.
- **Trigger frequency**: events per customer per day across `RECONCILE_TRIGGERS`. The job supersedes per customer, so burst writes collapse — measure how much that actually absorbs.

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
- `apps/api/src/modules/segment/services/reconcileCustomerRef.ts`
- `apps/api/src/jobs/handlers/reconcileCustomerRefSegments.ts`
- `apps/api/src/modules/segment/lib/reconcileTriggers.ts`
