# INFRA-022: Outbox drain — per-worker loop + poison-row quarantine

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: High
**Created**: 2026-06-24
**Updated**: 2026-06-24

> Follow-up to INFRA-021 (jobs overflow buffer). Moves the drain off the shared-queue cron onto a
> per-worker in-process loop so it can't be starved by the fan-out it meters, and adds poison-row
> quarantine. The `createLock` single-drainer guarantee is unchanged.

---

## Problem

The overflow-buffer drain shipped (INFRA-021) as a `makeSingletonJob` repeatable seeded in the shared
`jobs` queue. A 50k-job load test surfaced two issues:

1. **Starvation (the load-bearing one).** The drain competes for the same worker concurrency pool as
   the fan-out it exists to relieve. Under a large fan-out every slot is busy with sends and the drain
   — a plain wait-list job — can't get a slot until the backlog clears: starved by the very overflow it
   relieves. BullMQ `priority` does **not** fix it — `moveToActive` pops the wait list before the
   prioritized set, so a prioritized drain among non-prioritized fan-out runs last.
2. **Poison row at the FIFO head.** A row that can't be re-enqueued is re-fetched every tick; when
   `room` is small it occupies the whole batch and starves newer rows.

## Decision

- **Per-worker in-process drain loop** (`startOutboxDrainLoop`, every 15s), not a queued cron. Running
  on the event loop sidesteps the worker pool entirely. `createLock` (heartbeated TTL + fenced
  compare-and-del release) keeps the single-drainer-across-processes guarantee the `makeSingletonJob`
  cron lock provided.
- **Quarantine.** An `attempts` column bumps on each failed re-enqueue (`updateManyAndReturn` — the
  bare `updateMany` is banned by the mutationLifeCycle extension); past `MAX_DRAIN_ATTEMPTS` the drain
  skips the row so a poison head can't starve newer rows. Full recovery (queue healthy, nothing
  admittable) resets quarantined rows for one more chance before clearing the flag.
- **Flag clears only with no admittable backlog left**, else a fresh enqueue bypasses the buffer and
  jumps ahead of older buffered rows (FIFO break).

## Tasks

- [x] Extract the metering pass into `apps/api/src/jobs/outbox/drain/pass.ts`
- [x] Per-worker loop + `createLock` guard in `apps/api/src/jobs/outbox/drain/loop.ts`
- [x] Wire `startOutboxDrainLoop` / `stopOutboxDrainLoop` into the worker; drop the stale queued repeatable on startup
- [x] Remove the `drainOutbox` cron handler + its `cronJob.seed.ts` row
- [x] `attempts` column + `@@index([attempts, id])` on `JobOutbox`
- [x] Tests: failed-bump / skip-quarantined / recovery-reset (17 green vs Postgres + mock Redis)

---

## Resources

- Builds on: INFRA-021 (jobs overflow buffer)
- Concurrency primitives: [`docs/claude/CONCURRENCY.md`](../docs/claude/CONCURRENCY.md) (`createLock`)
- Jobs system: [`docs/claude/JOBS.md`](../docs/claude/JOBS.md)

---

## Comments

_Surfaced by the Zealot ZLT-3008 load test (the template #62 consumer). The `createLock` consolidation
flows template → consumer; the starvation fix flows consumer → template (here)._
