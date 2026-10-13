# INFRA-037 — Port rolling caches and the job coordinator from Zealot

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
- **Declared targets, not closures.** A small selector: `{ model, where, distinct: [cols] | select: [cols] }`.
  `distinct` takes pairs and sets, not just one column.
- **One coordinator.** A singleton cron job, seeded as a cron row (`registerCronJobs` / the admin
  cronJob module), so it is visible and its frequency is adjustable. It walks the registry each tick.
  Each cache keeps one timer per group in Redis with TTL = interval; a cache is due when its timer
  would expire before the next tick. No scheduler per cache, no cron row per cache.
- **Executor: one superseding job per target.** Newest wins; superseding is how a frozen refresh gets
  killed.
- **Overrun:** extend the unrefreshed entries' TTL and count the extension. Past `maxExtensions`,
  supersede the run and emit an AppEvent (`rollingCache.runSuperseded`). Zealot counts that event with
  a platform alert rule; the template has no platform alert rules, so the event is the hook and each
  app wires its own alert.
- **Full rebuild only.** Delta comes later, with sync channels.

## Generalize the coordinator while porting

In Zealot, the same coordinator also drives integration sync channels (ZLT-5432). So port it as a
registry of **coordinated jobs** rather than a rolling-cache-only one. Each registered kind declares:

| | Rolling cache | Sync channel |
|---|---|---|
| Targets | its selector | integration source rows × registered (remote object, local model) |
| Due | timer about to expire | unfinished cursor, or the interval since the last full pass has elapsed |
| Executor | superseding (no progress to lose) | `makeSingletonJob` with `lockKey` (cursor progress must survive) |

Collision policy is binary: a singleton skips the new run and superseding takes over. Nothing parks.
`makeSingletonJob(handler, { lockKey })` already lands in `13bf9cb0`. The coordinator continues an
unfinished chain on its next tick; jobs never requeue themselves.

Sync channels themselves (cursor columns, fetchers, shared ingest) are a separate ticket once Zealot's
shape settles. This ticket only needs the registry to have room for them.

## Done when

- `makeRollingCache` + registry + seeded coordinator + superseding target refresh, with the CI rule.
- The coordinator walks a registry of kinds, with rolling caches as the first kind.
- Tests cover due/not due, extend, supersede + AppEvent, and a target that fails to refresh.
