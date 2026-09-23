# INFRA-031: Jobs — port the Gate 5 lane, the lock hardening, and the claim policy from Zealot

**Status**: 👀 Review — §1 landed in template #104 (2026-09-13); §2 and §3 ported from merged Zealot #2248 on 2026-09-23 (branch `INFRA-031-slow-lane`)
**Assignee**: Aron
**Priority**: Medium (template's `createLock` carries the same refresh race Zealot fixes in #2271)
**Created**: 2026-09-12
**Updated**: 2026-09-23

The jobs rail converged with Zealot in June (INFRA-021 / INFRA-022: outbox, drain, `createLock`, `heartbeat`, lanes). Zealot has moved again. Bring each item below over once it lands there, in the shape Aron settled — not the shape of Zealot's first pass.

## What template already has (verified 2026-09-12)

- `makeSingletonJob` is a thin caller of `createLock` (`apps/api/src/jobs/makeSingletonJob.ts`). Zealot's #2271 is catching up to this; nothing to port for the constructor itself.
- Per-module `queries/` folders (`modules/{inquiry,segment,customerRef}/queries/`).
- `deliverEmail` claims the communication log row as `sending` inside `db.txn` before the provider call.

## What to port

### 1. `createLock` hardening — Zealot #2271 (ZLT-4600, closes ZLT-4658) — PORTED

Landed in [template #104](https://github.com/inixiative/template/pull/104). Two template-side deltas from Zealot: no `SINGLETON_LOCK_REFRESH_MS` knob (the singleton keeps its constants, the constructor assertion covers them), and `maxSafeHeartbeatMs` takes `commandTimeoutMs` as a required argument because no template Redis connection sets a command timeout — which also means a heartbeat on those connections can hang rather than time out. Whether to set one on the non-blocking connections (Zealot sets 5 s, excluding the BullMQ worker and subscribers) is open.

The pre-port `tick()` used `GET` then `PEXPIRE`, allowing a refresh to extend a new holder's TTL. The current `createLock` calls `fencedRefresh` in one Lua eval. The implemented hardening is:
- The refresh is one compare-and-expire Lua eval. `0` = token definitively not ours → declare lost, reason `token_mismatch`, stop the heartbeat. A thrown refresh spends the missed-beat budget; exhausting it declares loss with reason `refresh_errors` but keeps refreshing (ownership uncertain, not gone).
- `declareLost` never runs the fenced delete mid-run. `release()` always does, once, after the critical section, and reports `released` / `notHeld` / `unconfirmed`.
- `maxSafeHeartbeatMs(ttl, maxMissed, commandTimeout)` and the constructor assertion built on it.
- `LockOptions` takes an injected connection and a key override (`{ service, identifier } | { key }`). Relevant here because the singleton lock should run on the queue's connection, not the eviction-prone cache store — the same split Zealot made in ZLT-4235 (`REDIS_BULLMQ_URL` vs the cache URL); template now prefers `REDIS_BULLMQ_URL`, with a warned fallback to `REDIS_URL` (`apps/api/src/jobs/bullmqRedisUrl.ts`).
- A singleton run that loses its lock is **not cancelled** (no cooperative cancellation on the worker context; racing the handler would leave a third run in the background). It finishes and reports `lockLost` → `completedAfterLockLoss` / `failedAfterLockLoss`.

### 2. Fast / slow lane — Zealot #2248 (ZLT-4633), the reworked shape — PORTED

Landed in #118, then reshaped (Aron, 2026-09-23) — **priority and pressure, no slot cap**:
- **Slow jobs wait in the one shared BullMQ queue at the lowest priority** (`SLOW_LANE_PRIORITY = PRIORITY_LIMIT`, `jobs/lanePriority.ts`). BullMQ takes plain waiting jobs before prioritized ones, so fast work is always picked first while idle slots still run slow work — capacity stays fully shared. No slot cap, no worker presence, no Lua lease set, no self-feed, no refusal path. Measured against real Redis (2 workers × 10, 3000 × 60 ms slow jobs): FIFO fast-job wait p50 7.8 s; priority 41 ms. A cap enforced by re-queuing refused slow jobs cut fast wait to 2 ms but cost ~19 re-queues per slow job and 40% of slow throughput, so it was dropped. The trade: a fast job arriving while every slot is busy with slow work waits for one to finish — fine for short slow handlers.
- **Pressure is one depth budget divided by lane.** `JOBS_MAX_QUEUE_DEPTH` counts waiting + prioritized + active; slow (`prioritized`) may fill `JOBS_SLOW_QUEUE_DEPTH_FRACTION` of it. Each lane has its own overflow flag and spills to the outbox in batches; the drain refills each lane in batches (one read + one delete per lane per pass) at a 2s tick so a quickly-emptied slow share is refilled before slots idle.
- **Outbox lane is a column** (`JobOutbox.lane`, enum `JobLane`, index `(lane, attempts, id)`), mirroring `data.lane`; Zealot filters by JSON path.
- **No chunking.** The template keeps its per-recipient `deliverEmail` and puts fan-outs wider than `EMAIL_SLOW_LANE_MIN_RECIPIENTS` on the slow lane, enqueued concurrently. Send-time suppression is already per-recipient (`canDeliver` reads the contact at delivery).
- Env knobs in the Zod schema; test overrides for them are parsed through the same fields. Modules that read a knob import `#/config/env`.
- `apps/api/scripts/slowLaneCheck.ts` validates the path against real Redis, BullMQ and Postgres.
- Not ported: Zealot's `JobsWorker:*` blocking-connection rule — template connections set no command timeout (see §1's open question).

The original forecast for this section, superseded by the above:

- `lane` is a **tag on the job data envelope** next to `type`, resolved once as `request ?? enqueue option ?? handler default`; no default = fast. No wrapper constructor. The superadmin manual-enqueue and cron-trigger requests expose the override; every `queue.add` site stamps it (cron register/trigger bypass `enqueueJob`).
- **No second parking mechanism.** Slow-lane jobs buffer in the outbox (new `lane` column); the drain admits fast rows first, then slow rows while the slot set has room, bounded per pass. No `moveToDelayed` / `DelayedError` / processor token.
- The worker holds a Lua slot lease while a slow job runs (ZSET scored by lease expiry, heartbeat renew, fenced release, PEXPIRE on the key). That lease is the running-count the drain reads.
- A **worker presence set** in Redis (instance id, TTL heartbeat) so the cap is `fraction × concurrency × live instances`, one global slot set — not a per-instance key.
- Redis scripts live in `apps/api/src/jobs/queries/`, one TS module per script (the `queries/` convention applied to Redis). Move the two `lanes` scripts and the `createLock` scripts there when touching them.
- `validateJobId` is its own file (BullMQ rejects custom ids containing `:` unless exactly three segments; `0` / `0:` prefixes are also invalid). Called from enqueue and the drain.
- Every worker knob (`JOBS_WORKER_CONCURRENCY`, slot fraction, lease TTL, …) is in the env schema with defaults in the example env files; no side parser.

### 3. Delivery claim policy — Aron's ruling on #2248, 2026-09-12 — PORTED

`deliverEmail` (body in `lib/email/deliverEmailMessage.ts`) now claims only `queued` rows — it previously claimed `queued | failed`, so a BullMQ retry after a recorded failure resent. Post-claim failures are recorded with a `reasonCode` (new `CommunicationLog.reasonCode`, enum `CommunicationReasonCode`) and not thrown. Retryable provider failures (Resend rate limit / 5xx, classified by `EmailProviderError`) retry inside the claim (5 retries, 2→32s); 408, network failure (`ambiguous_timeout`) and quota walls close on the first attempt. Pre-claim: content errors close as `render_failed`; infrastructure errors (database, verifier) throw with the row still `queued`, since nothing was sent. Sends carry `Idempotency-Key: communicationLogId`. The admin view + explicit resend with a staleness bound (Zealot ZLT-4716) is not built here.

The claim reads **row state only**; which job wrote the row never decides anything. No row → open; SENT, any failure, or a SENDING row → closed. A concurrent attempt that meets a SENDING row skips it. An unfinished SENDING row (worker died mid-call) is a normal outcome and stays as written; an ambiguous provider timeout is closed as `ambiguous_timeout`. Neither is ever reclaimed or resent by the claim. Retryable provider failures (429 / 5xx) retry inside the claim, then record a `reasonCode` and stop. What replaces a sweeper is an **admin view** of orphaned / unsure rows with resend as an explicit action, plus a staleness bound on the resend path.

Check `deliverEmail` against this: confirm its `sending` claim is row-state only, add `reasonCode` on the communication log if absent, and do not add settlement-by-job-id or a reclaim window.

## Not to port

- `settledByJobId` / same-job re-drive / claim-window comparison (deleted from #2248).
- `envNumber` (deleted from #2248 / #2271).
- The delivery queue and virtual-time priority work from Zealot #2222 / #2226 (closed without merge).

## Exit criteria

Met on `INFRA-031-slow-lane`, pending review.


`createLock` refresh is one eval with the tri-state release and tests mirroring Zealot's; the lane tag + outbox lane + presence set exist with the drain ordering test; `deliverEmail` claim audited against §3; Redis scripts under `jobs/queries/`.
