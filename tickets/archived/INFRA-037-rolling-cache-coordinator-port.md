# INFRA-037 — Port rolling caches, staged jobs on every constructor, and the binary collision policy from Zealot

**Status:** ✅ Done — ported from Zealot #2786 (ZLT-5492) at `3e52ece0a9`, 2026-10-15, on main · **Line:** INFRA · **Related:** INFRA-035, INFRA-031, OTEL-002, Zealot ZLT-5432 (#2807)

## Problem

The template had `cache()` for read-through caching but nothing kept a cache warm on a timer, so each
app that needs "refresh X every N minutes" would add its own cron row and scheduler. Zealot folded those
into one system in #2786, and in the same PR settled the job primitives it is built on: staged jobs on
every constructor, a binary collision policy, and superseding children that honour their parent.

## What landed

**Collision policy is binary: a singleton skips, superseding takes over, nothing parks.**
- `makeSingletonJob(definition, { lockKey })` (keyed skip landed in `13bf9cb0`) now exposes
  `singletonKey`; `enqueueJob` adds a keyed singleton (or a singleton's cron run) with BullMQ
  `deduplication: { id: singletonDeduplicationId(handler, key) }`, so the skip also holds while a staged
  singleton is parked in `waiting-children`.
- Cron ticks enqueue: `processJob` hands a `cron` tick to `enqueueCronRun`, which enqueues the real run
  as `cronTrigger` with the row id, like the admin trigger. A repeatable's template cannot carry a
  deduplication id.
- CI: `no-job-parking` (only `claimSlotOrRequeue` may `moveToDelayed`/`new DelayedError`).
- `sendWebhook` was already a plain job in the template; nothing to change.

**Staged jobs on every constructor.** `makeJob`, `makeSingletonJob` and `makeSupersedingJob` take a
handler or `{ stages, finish }` through `toJobHandler`. One file per function: `runJobStages.ts`,
`makeEnqueueChildJob.ts`, `parkOnUnfinishedChildren.ts`, `validateChildJobHandler.ts`. The stage index
is on the job; after each stage the job parks on unfinished children; a run resuming past stage 0 parks
first. Children are added with `{ parent, ignoreDependencyOnFailure: true }`; inline (tests) there is no
parent and a throwing child fails its parent. A superseding parent only adds superseding children.
`traceJob` treats BullMQ wait signals as OK spans. CI: `no-hand-rolled-flows`.

**Superseding children honour a superseding parent's tombstone.** At start a superseding job exits (and
writes its own tombstone, `tombstoneJob`) if it or `job.parent.id` is tombstoned; `watchLane(lane, jobId,
onUsurped, parentId)` does the same while it runs. A parked superseding parent holds its lane for the
tombstone's lifetime (`holdLaneWhileParked`). No eviction step.

**Rolling caches.** `makeRollingCache` in `packages/db/src/redis/` (next to `cache()`), registry
(`getRollingCache` throws for an unknown name), targets as `{ model, args }` with Prisma's own
`findMany` args resolved through `db.delegate` (Postgres `DISTINCT`, fail-closed ceiling), three times
(`intervalSeconds`, `timeoutSeconds`, `ttlSeconds`, validated at registration), `refresh` throws when the
write fails. Root `coordinateRollingCaches` (seeded cron row, every minute, singleton) → branch
`refreshRollingCache` (keyed staged singleton; `finish` sets the timer) → leaf `refreshRollingCacheTarget`
(superseding by key, slow lane, `settleWithin` + `AbortSignal.any` timeout, emits
`rollingCache.leafStuck` and throws). Barrel `apps/api/src/lib/rollingCaches.ts` imported by the worker;
CI: `rolling-cache-registered`. No supervisor, no pending hash, no refire. Full rebuild only.

**Verification.** Unit tests for all of the above, plus `apps/api/scripts/jobFlowCheck.ts`, which runs
flows, singleton deduplication, parent tombstones and cron hand-off against real Redis and a real worker.

Docs: [JOBS.md](../../docs/claude/JOBS.md) (Handler Patterns, Singleton, Staged Job, Rolling Caches, Cron
Jobs), [REDIS.md](../../docs/claude/REDIS.md#rolling-caches).

## Deliberately left out

- **The leaf-stuck platform alert rule and its runbook.** The template has no platform alert rules; the
  `rollingCache.leafStuck` app event is recorded as an `AppEvent` row and is the hook. Listed as a
  candidate first rule on OTEL-002.
- **Zealot-specific sinks:** the Salesforce/package 207 retry in `sendWebhook`, Zealot's platform alert
  sync lock, and the `FanUserEnrichment` index.

## Not a registry

Each kind of coordinated work gets its own coordinator built from the shared primitives. Zealot's
integration sync channels (ZLT-5432) get a separate coordinator rather than registering into this one.
Extract a shared walk only if a third coordinator turns up with the same shape.
