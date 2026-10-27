# INFRA-046 — Cache primitives from Zealot after INFRA-037

**Status:** ✅ Done — ported from Zealot #2872 (ZLT-5670, merged at `6945e60f6a`), 2026-10-27 · **Line:** INFRA · **Related:** INFRA-037, INFRA-035, INFRA-044

## Problem

INFRA-037 ported rolling caches from Zealot #2786. Zealot's AI rules stack (#2872) then changed the
cache under them:

- A value computed before a clear could still land after it: `cache()` wrote unconditionally.
- N cold readers of a rolling cache sent N refresh enqueues.
- An aborted rolling refresh held its lock until `compute` returned, and a second release could delete
  a successor's lock.
- Everything sat in one 335-line `redis/cache.ts`, with single-flight inside it.

## What landed

**A clear cancels the computes it races.** `cache()` captures the key's generation and the cache-wide
epoch after it takes the single-flight lock and before the producer runs, and publishes through one
Lua call that writes only if neither moved (`queries/publishIfCurrent`). An exact `clearKey` deletes
the value and its write time and moves the generation in one call (`queries/clearExact`); a pattern
clear moves the epoch before it scans and now throws when it fails. `upsertCache` writes through with
a fresh generation (`queries/writeThrough`).
Without the lock or the generation the value is returned unpublished. INFRA-044 step 3 depends on
this.

**Queued state.** `checkCache` reports `queued` (a refresh is enqueued and has not taken its lock),
and `isQueued` beside a held value. `checkRollingCache` sets the target's queued marker and enqueues
only if it set it; a failed enqueue clears the marker. A refresh that wrote clears it; an aborted one
leaves it for its retry.

**Locks.** A rolling refresh releases its lock when its signal aborts. `createLock`'s `release` is
sent once and shared, a released lock cannot acquire again, and a release that lands during a pending
SET deletes the key that SET wrote. Single-flight is a lock, so it moved to
`packages/db/src/lock/singleFlight/`, its key built with `lockKeyOf`. The poll loop
(`acquireSingleFlight`) stays its own function: it reads the cache between attempts, which
`acquire({ waitMs })` cannot.

**Layout.** `packages/db/src/redis/cache/`, one file per behaviour, with `generation/`, `queued/`,
`queries/` (every Lua script a typed function over `RedisEval`), `telemetry/` and `rollingCache/`.

**Refresh errors are not a loss (Zealot ZLT-4600).** `maxMissed` and `LockLostReason` are gone: a
thrown refresh warns and the heartbeat keeps refreshing; only a token mismatch declares the lock lost.
A run that loses its lock is never cancelled, so the missed-beat budget only decided how loudly to log
(Aron, 2026-10-27).

**Telemetry.** A `cache <accessor>` span per call, `cache.read` by accessor and result,
`cache.lock.wait`, `cache.publish.skipped`. Large writes keep the template's `log.warn` record, now
tagged by accessor.

**Options.** `cache(key, fn, ttl, { shouldBypassInTxn })`, from Zealot #2735 (ZLT-5337). Zealot's
`shouldKeepExisting` and evict-only clears are not ported: generations already make a write-through win,
and a bad value is dropped by checking it before clearing (Aron, 2026-10-27).

**Warm on boot.** The worker enqueues every registered cache's branch when it starts
(`warmRollingCaches`).

## Left as is

- `spreadSeconds` keeps its default of half the interval. Zealot requires it; the template's default
  is fine (Aron, 2026-10-27).
- `unavailable` rule-reference refusals, `pruneConditionClauses` and `foldText` from the same Zealot
  stack are not cache work. The first needs an own-tenant read; the other two belong in json-rules
  (with INFRA-042).
