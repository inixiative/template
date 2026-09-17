# INFRA-030: Jobs — port the Gate 5 lane, the lock hardening, and the claim policy from Zealot

**Status**: 📋 Todo — blocked until Zealot #2248 (reworked per Aron's 2026-09-12 review) and #2271 merge
**Assignee**: Aron
**Priority**: Medium (template's `createLock` carries the same refresh race Zealot fixes in #2271)
**Created**: 2026-09-12
**Updated**: 2026-09-12

The jobs rail converged with Zealot in June (INFRA-021 / INFRA-022: outbox, drain, `createLock`, `heartbeat`, lanes). Zealot has moved again. Bring each item below over once it lands there, in the shape Aron settled — not the shape of Zealot's first pass.

## What template already has (verified 2026-09-12)

- `makeSingletonJob` is a thin caller of `createLock` (`apps/api/src/jobs/makeSingletonJob.ts`). Zealot's #2271 is catching up to this; nothing to port for the constructor itself.
- Per-module `queries/` folders (`modules/{inquiry,segment,customerRef}/queries/`).
- `deliverEmail` claims the communication log row as `sending` inside `db.txn` before the provider call.

## What to port

### 1. `createLock` hardening — Zealot #2271 (ZLT-4600, closes ZLT-4658)

Template's `tick()` (`packages/db/src/lock/createLock.ts`) is `GET` then `PEXPIRE`: the key can expire and be re-acquired between the two calls, and the refresh then extends the new holder's TTL. Port:
- The refresh is one compare-and-expire Lua eval. `0` = token definitively not ours → declare lost, reason `token_mismatch`, stop the heartbeat. A thrown refresh spends the missed-beat budget; exhausting it declares loss with reason `refresh_errors` but keeps refreshing (ownership uncertain, not gone).
- `declareLost` never runs the fenced delete mid-run. `release()` always does, once, after the critical section, and reports `released` / `notHeld` / `unconfirmed`.
- `maxSafeHeartbeatMs(ttl, maxMissed, commandTimeout)` and the constructor assertion built on it.
- `LockOptions` takes an injected connection and a key override (`{ service, identifier } | { key }`). Relevant here because the singleton lock should run on the queue's connection, not the eviction-prone cache store — the same split Zealot made in ZLT-4235 (`REDIS_BULLMQ_URL` vs the cache URL); template still shares one `REDIS_URL`.
- A singleton run that loses its lock is **not cancelled** (no cooperative cancellation on the worker context; racing the handler would leave a third run in the background). It finishes and reports `lockLost` → `completedAfterLockLoss` / `failedAfterLockLoss`.

### 2. Fast / slow lane — Zealot #2248 (ZLT-4633), the reworked shape

- `lane` is a **tag on the job data envelope** next to `type`, resolved once as `request ?? enqueue option ?? handler default`; no default = fast. No wrapper constructor. The superadmin manual-enqueue and cron-trigger requests expose the override; every `queue.add` site stamps it (cron register/trigger bypass `enqueueJob`).
- **No second parking mechanism.** Slow-lane jobs buffer in the outbox (new `lane` column); the drain admits fast rows first, then slow rows while the slot set has room, bounded per pass. No `moveToDelayed` / `DelayedError` / processor token.
- The worker holds a Lua slot lease while a slow job runs (ZSET scored by lease expiry, heartbeat renew, fenced release, PEXPIRE on the key). That lease is the running-count the drain reads.
- A **worker presence set** in Redis (instance id, TTL heartbeat) so the cap is `fraction × concurrency × live instances`, one global slot set — not a per-instance key.
- Redis scripts live in `apps/api/src/jobs/queries/`, one TS module per script (the `queries/` convention applied to Redis). Move the two `lanes` scripts and the `createLock` scripts there when touching them.
- `validateJobId` is its own file (BullMQ rejects custom ids containing `:` unless exactly three segments; `0` / `0:` prefixes are also invalid). Called from enqueue and the drain.
- Every worker knob (`JOBS_WORKER_CONCURRENCY`, slot fraction, lease TTL, …) is in the env schema with defaults in the example env files; no side parser.

### 3. Delivery claim policy — Aron's ruling on #2248, 2026-09-12

The claim reads **row state only**; which job wrote the row never decides anything. No row → open; SENT, any failure, or a SENDING row → closed. A concurrent attempt that meets a SENDING row skips it. An unfinished SENDING row (worker died mid-call) is a normal outcome and stays as written; an ambiguous provider timeout is closed as `ambiguous_timeout`. Neither is ever reclaimed or resent by the claim. Retryable provider failures (429 / 5xx) retry inside the claim, then record a `reasonCode` and stop. What replaces a sweeper is an **admin view** of orphaned / unsure rows with resend as an explicit action, plus a staleness bound on the resend path.

Check `deliverEmail` against this: confirm its `sending` claim is row-state only, add `reasonCode` on the communication log if absent, and do not add settlement-by-job-id or a reclaim window.

## Not to port

- `settledByJobId` / same-job re-drive / claim-window comparison (deleted from #2248).
- `envNumber` (deleted from #2248 / #2271).
- The delivery queue and virtual-time priority work from Zealot #2222 / #2226 (closed without merge).

## Exit criteria

`createLock` refresh is one eval with the tri-state release and tests mirroring Zealot's; the lane tag + outbox lane + presence set exist with the drain ordering test; `deliverEmail` claim audited against §3; Redis scripts under `jobs/queries/`.
