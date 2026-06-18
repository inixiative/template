# INFRA-021: Jobs Overflow Buffer

**Status**: 👀 Review
**Assignee**: Aron
**Priority**: High
**Created**: 2026-06-18
**Updated**: 2026-06-18

> **Shipped (reconciled with implementation):** depth probe counts `waiting + active` (not `delayed` — that includes scheduled cron repeats). No `collapseKey` column — the row stores `jobId @unique` + nullable `dedupeKey`, with `@@unique([handlerName, dedupeKey])`. **Everything (fan-out + superseding) routes through the one accumulator.** The flush dedups in a txn: latest-per-lane within the batch, then plain rows via `createMany({ skipDuplicates })` and superseding lanes via `upsert` (cross-process last-wins — `skipDuplicates` would keep whichever commits first and silently drop the latest). The supersede signal fires only on the *direct* path (the spill path supersedes at drain admission). The flush and drain share one mutex (`runOnOutboxQueue`). The overflow flag is a start-timestamp with a drain-renewed TTL + a stuck-overflow alert. Shutdown loops + bounded-retries, resets `closing`, wired into worker **and** API. `enqueueJobs(payloads[])` not built — the accumulator makes a single caller unnecessary. Tests written (unrun without Postgres/Redis); cap-edge cases testable via lazy config.

---

## Overview

A generic, durable overflow buffer in front of BullMQ, added at the single `enqueueJob`
chokepoint. Under normal load jobs go straight to the queue; once queue depth crosses a cap, an
"overflow" flag flips and further enqueues spill to a Postgres `JobOutbox` table, which a singleton
cron meters back into BullMQ as room frees up.

This lets us keep **one job per unit of work** (clean `jobId`-based idempotent retries, per-job
observability) while bounding how many jobs sit in Redis at any instant — the alternative to
chunking, which changes the unit of work and forces an anti-join ledger. BullMQ's rate limiter caps
*processing* rate but not Redis *memory*; the waiting jobs still pile up. This bounds depth.

Full design: [`docs/design/jobs-overflow-buffer.md`](../docs/design/jobs-overflow-buffer.md).

## Objectives

- ✅ Bound BullMQ/Redis queue depth on large fan-outs without losing jobs
- ✅ Generic for all job types — instrumented once at the `enqueueJob` chokepoint
- ✅ Durable: a spilled job is never lost to a crash/redeploy
- ✅ Keep per-job idempotent retries (no chunking, no anti-join ledger)

---

## Tasks

### Flag + depth probe
- [ ] Global overflow flag in Redis (`${redisNamespace.job}:overflow`)
- [ ] Cached depth probe via `queue.getJobCounts('waiting','delayed')` (short TTL, fleet-global)
- [ ] Trip inline when an enqueue observes depth ≥ `MAX_QUEUE_DEPTH`; clear at a low-water mark

### Enqueue chokepoint (`apps/api/src/jobs/enqueue.ts`)
- [ ] Flag check: clear → `queue.add`; set → spill
- [ ] `bypass` option for latency-critical jobs (skip cap, always direct)
- [ ] `enqueueJobs(name, payloads[])` batch entry point for fan-out producers

### Spill batcher (coalescing write-behind)
- [ ] In-process accumulator `{ row, resolve, reject }`
- [ ] Size **or** time trigger (`FLUSH_MAX_ROWS` ~1000 / `FLUSH_LINGER_MS` ~200)
- [ ] Synchronous swap → `createSerializedQueue.run(createMany)` (one write at a time)
- [ ] `resolve` wired to the `createMany` commit — **not** to accumulation
- [ ] Flush accumulator on shutdown (SIGTERM/redeploy)

### `JobOutbox` model + migration
- [ ] `id` (uuidv7), `handlerName`, `jobId`, `collapseKey?`, `data` (Json), `createdAt`
- [ ] `@@unique([handlerName, collapseKey])`, `@@index([id])`

### Dedupe-aware spill
- [ ] `collapseKey = dedupeKey ?? options.id`
- [ ] Adhoc (null key) → `createMany`; keyed (singleton/superseding) → `upsert`
- [ ] Extend `signalSupersededJobs` to also clear matching outbox rows (reconcile across queue + outbox)

### Drain (`drainOutbox`)
- [ ] Singleton cron via `makeSingletonJob` (`createLock`-backed), every 15–30s
- [ ] Top up to cap: `room = MAX_QUEUE_DEPTH − depth`; plain `findMany(take: room)` (no FOR UPDATE)
- [ ] Re-enqueue with stored `jobId` via `queue.add` **directly** (bypasses cap)
- [ ] Delete drained rows; clear flag at low-water

### Tests
- [ ] Spill engages at cap; drain re-admits to the queue
- [ ] No double-enqueue when the drain re-runs (jobId fence)
- [ ] Superseding job buffered in the outbox is reconciled by a newer instance
- [ ] `bypass` jobs go direct under overflow
- [ ] Batcher: size + time triggers; serialized flushes; resolve-on-commit; shutdown flush

---

## Open Questions

- **Worst-case single fan-out size** — sets `MAX_QUEUE_DEPTH` and confirms batcher sizing. Working
  assumption: we won't loop 50k; we hit the cap fast, flip to overflow, and bulk-spill the tail.
- Defaults to lock: `MAX_QUEUE_DEPTH`, low-water ratio (~0.8), `FLUSH_MAX_ROWS` (~1000),
  `FLUSH_LINGER_MS` (~200), drain interval (15–30s).

---

## Implementation Notes

Load-bearing invariants (detail in the design doc):

- **The drain is at-least-once — handlers must be idempotent.** `createLock` guarantees one drainer,
  but a crash between `queue.add` and the row delete re-admits the row. The stored `jobId` dedups a
  replay only while it's still in Redis — `queue.ts` `removeOnComplete: { count: 100 }` evicts it
  under load — so the jobId narrows the window but is **not** an exactly-once fence. (Corrected from
  the original "exactly-once" claim per review.)
- **Spill resolves on commit** — no in-memory loss window. `flushOutbox` runs after intake stops, on
  **both** the worker and API shutdown, and observes/logs flush failure.
- **Flag is set inline** (not only by the cron) — a fan-out fills the queue long before the next
  tick, so the producer side must trip it; the cron only clears it.
- **No worker-awareness** — the cap is on queue depth, which `getJobCounts` reports fleet-globally;
  a fixed env cap feeds any realistic fleet.
- `createSerializedQueue` serializes the **flush writes** (not the enqueue gate) — its canonical
  "serialize writes to one resource" use.

Prerequisite refactor **(done)**: `makeSingletonJob` folded onto `createLock` (was a less-safe
bespoke `SET NX` + unconditional `del`); the drain inherits the fenced lock.

---

## Definition of Done

- [ ] Queue depth stays bounded under a large fan-out; no jobs lost across a crash/redeploy
- [ ] All job types covered via the one chokepoint; `bypass` keeps transactional jobs direct
- [ ] Singleton/superseding semantics preserved in the buffer (collapse + cross-location reconcile)
- [ ] `docs/design/jobs-overflow-buffer.md` kept in sync
- [ ] Tests passing

---

## Resources

- Design: [`docs/design/jobs-overflow-buffer.md`](../docs/design/jobs-overflow-buffer.md)
- Concurrency primitives: [`docs/claude/CONCURRENCY.md`](../docs/claude/CONCURRENCY.md) (`createLock`, `createSerializedQueue`)
- Jobs system: [`docs/claude/JOBS.md`](../docs/claude/JOBS.md)
- PR: inixiative/template#62 (email send path — first consumer)

---

## Related Tickets

- API-001 (Idempotency and Safe Retries) — shares the jobId-as-fence concept
- COMM-001 (Email System) — first consumer (Sender fan-out)
- FEAT-012 (Notifications) — channel-agnostic consumer

---

## Comments

_Emerged from the ZLT-3008 email send-path design (template #62): rather than chunk the
per-recipient fan-out, keep per-recipient jobs and add a generic durable overflow buffer. The
`makeSingletonJob` → `createLock` refactor landed alongside._
