# INFRA-037 — Port rolling caches and their coordinator from Zealot

**Status:** todo · **Line:** INFRA · **Related:** INFRA-035, Zealot ZLT-5492 (#2786), Zealot ZLT-5432 (#2807)

## Problem

The template has `cache()` (`packages/db/src/redis/cache.ts`) for read-through caching, but nothing
keeps a cache warm on a timer. Each app that needs "refresh X every N minutes" ends up adding its own
cron row and scheduler. Zealot did exactly that and folded them back into one system in #2786. The
template should get that system before an app here copies the per-cache scheduler shape.

## What to port

Port from Zealot once #2786 merges; that PR is the source of truth.

- **`makeRollingCache`**, defined inline next to the code that reads it, and registered in one place.
  A CI rule (`rolling-cache-registered`) fails a rolling cache that isn't registered.
- **Targets are a Prisma query, limited to what can go in a job payload.** `{ model, where?, distinct | select:
  [cols] }`: `model` picks the delegate (`runtimeDelegate`), `where` is Prisma's own type, and the
  columns are typed to JSON scalars, because each row becomes a job payload. An arbitrary `select`
  could pull relations, BigInt or Date into a payload. There's no targets table: targets come from
  live data, and the compute callback and cache key are code. Zealot #2786 runs distinct as
  `groupBy` because Prisma dedupes `findMany` distinct in memory on MySQL. The template's
  RuntimeDelegate has no `groupBy`, but Postgres can do a real `DISTINCT`, so use `findMany` distinct.
  Confirm in a query log that the template's Prisma version sends `DISTINCT` and `LIMIT` (it was the
  `nativeDistinct` preview flag in some versions). Keep the fail-closed target ceiling.
- **One coordinator.** A singleton cron job, seeded as a cron row (`registerCronJobs` / the admin
  cronJob module), so it is visible and its frequency is adjustable. It walks the registered rolling caches each tick.
  Each cache keeps one timer per group in Redis with TTL = interval; a cache is due when its timer
  would expire before the next tick. No scheduler per cache, no cron row per cache.
- **Executor: one superseding job per target.** Newest wins; superseding is how a frozen refresh gets
  killed.
- **Overrun:** extend the unrefreshed entries' TTL and count the extension. Past `maxExtensions`,
  supersede the run and emit an AppEvent (`rollingCache.runSuperseded`). Zealot counts that event with
  a platform alert rule; the template has no platform alert rules, so the event is the hook and each
  app wires its own alert.
- **Full rebuild only.** Delta comes later, with sync channels.

## Not a registry

Each kind of coordinated work gets its own coordinator, seeded as its own cron row and built from the
shared primitives (`makeSingletonJob` with `lockKey`, `makeSupersedingJob`, `enqueueJob`,
`runtimeDelegate` + Prisma args). Zealot's integration sync channels (ZLT-5432) get a separate
coordinator rather than registering into this one. The two share only walk targets → due? → enqueue
if not running; their due rules, overrun handling, executor and state all differ. Extract a shared
walk only if a third coordinator turns up with the same shape.

Collision policy is binary: a singleton skips the new run, superseding takes over, and nothing parks
(`makeSingletonJob(handler, { lockKey })` landed in `13bf9cb0`).

## Done when

- `makeRollingCache` + its registration + seeded coordinator + superseding target refresh, with the CI rule.
- Tests cover due/not due, extend, supersede + AppEvent, and a target that fails to refresh.
