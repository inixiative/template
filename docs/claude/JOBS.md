# Jobs

<!-- toc:start -->

## Contents

- [Job System](#job-system)
  - [Worker Configuration](#worker-configuration)
  - [Job IDs](#job-ids)
- [Built-in Handlers](#built-in-handlers)
  - [sendWebhook](#sendwebhook)
  - [reconcileSegment / reconcileCustomerRefSegments / sweepSegments](#reconcilesegment--reconcilecustomerrefsegments--sweepsegments)
  - [rotateEncryptionKeys](#rotateencryptionkeys)
- [Creating Handlers](#creating-handlers)
  - [1. Define Handler](#1-define-handler)
  - [2. Register in Index](#2-register-in-index)
- [Handler Patterns](#handler-patterns)
  - [ctx.log() - Dual-Write Logging](#ctxlog---dual-write-logging)
  - [Singleton Job](#singleton-job)
  - [Superseding Job](#superseding-job)
- [Enqueuing Jobs](#enqueuing-jobs)
- [Fast and Slow Lanes](#fast-and-slow-lanes)
  - [Choosing a Lane](#choosing-a-lane)
  - [Priority: Fast Work Is Always Picked First](#priority-fast-work-is-always-picked-first)
  - [Pressure: One Budget, Divided by Lane](#pressure-one-budget-divided-by-lane)
  - [Lane Configuration](#lane-configuration)
  - [Validating Against Real Infrastructure](#validating-against-real-infrastructure)
- [Overflow Buffer](#overflow-buffer)
  - [Spill Routing](#spill-routing)
  - [Accumulator](#accumulator)
  - [Drain Loop](#drain-loop)
  - [Overflow Flag](#overflow-flag)
  - [Queue Depth Probe](#queue-depth-probe)
  - [Overflow Configuration](#overflow-configuration)
- [Cron Jobs](#cron-jobs)
  - [Cron Patterns (UTC)](#cron-patterns-utc)
  - [CronJob Model](#cronjob-model)
  - [Admin Routes](#admin-routes)
  - [JobType Values](#jobtype-values)
- [BullBoard](#bullboard)
  - [Access](#access)
  - [Configuration](#configuration)
  - [Error Boundaries](#error-boundaries)
  - [Features](#features)

<!-- toc:end -->


---

## Job System

BullMQ-based background jobs in `apps/api/src/jobs/`.

```
jobs/
├── handlers/
│   ├── index.ts        # Registry of all handlers
│   └── sendWebhook.ts  # Individual handler
├── outbox/             # Durable overflow buffer (see Overflow Buffer)
│   ├── drain/          # Per-worker drain loop + pass
│   ├── accumulator.ts  # Batched outbox writes (spillToOutbox/flushOutbox)
│   ├── config.ts       # Caps, linger, TTLs (from the env schema)
│   ├── flag.ts         # Redis overflow flag (set-once + TTL/heartbeat)
│   ├── mutex.ts        # Serialized queue shared by flush + drain
│   ├── queueDepth.ts   # Cached waiting+active depth probe
│   └── types.ts        # OutboxRow + shouldSpill
├── admitEnvelope.ts    # Routes a built envelope: BullMQ (at its lane's priority) or the outbox
├── admitToSlot.ts      # Job-start check: slow slot cap, and returning a line-jumper to its priority
├── buildJobData.ts     # The one job-data envelope every producer builds (lane resolved here)
├── enqueue.ts          # enqueueJob function
├── lanePriority.ts     # Slow lane → lowest BullMQ priority
├── makeJob.ts          # Job wrapper constructors
├── processJob.ts       # Per-job processor: slot admission, scopes, tracing
├── queue.ts            # BullMQ queue setup
├── registerCronJobs.ts # Cron registration on worker startup
├── slowSlotPool.ts     # Per-worker count of slots running slow jobs
├── types.ts            # Type definitions
├── validateJobId.ts    # BullMQ custom-id rules, shared by enqueue and the drain
└── worker.ts           # Worker entry point
```

### Worker Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Concurrency | `JOBS_WORKER_CONCURRENCY` (10) | Max parallel jobs per worker |
| Lock Duration | 5 min | Time before stalled job is retried |
| Separate Redis | Yes | Worker uses own connection (BullMQ requirement) |

### Job IDs

| Scenario | jobId | `id` (job data) |
|----------|-------|-----------------|
| Ad-hoc / superseding | `jobOptions.jobId ?? uuidv7()` | the logical `id` is data-only (the singleton-lock identity) — never the jobId |
| Superseding | (as above) | supersession is by `dedupeKey` → a per-lane claim (`claimLane`/`watchLane`, last-wins), not the jobId |
| Cron | `cronJob.jobId` (repeatable scheduler key) | `cronJob.id` — the singleton-lock identity |

Scope ID format for logging: `[worker][{handlerName}:{jobId}]`

---

## Built-in Handlers

### sendWebhook

Delivers webhooks to subscribers. Enqueued by the webhook hook on DB mutations.

```typescript
await enqueueJob('sendWebhook', {
  subscriptionId: sub.id,
  action: 'create',       // 'create' | 'update' | 'delete'
  resourceId: record.id,
  data: { ...payload },
});
```

| Feature | Detail |
|---------|--------|
| Signing | RSA-SHA256 (`X-Webhook-Signature` header) |
| Timeout | 5 seconds per delivery |
| Circuit breaker | Disables after 5 consecutive failures |
| Poisoned records | Integration-owned subscriptions skip a record after 3 rejections (HTTP 400/422) while other records deliver |
| Logging | Creates `WebhookEvent` record per attempt |

### reconcileSegment / reconcileCustomerRefSegments / sweepSegments

Segment membership. `reconcileSegment` (superseding by segment id) recomputes one segment set-wise via `toPrisma` — static or dynamic, it runs when `segment.created` / `segment.updated` says the rule changed — and fans out to the dynamic segments that reference it. `reconcileCustomerRefSegments` (payload `{ customerModel, customerId }`, superseding by that pair and resolving it to the customer's references) hydrates each customer reference through `fetchLens` and runs `check()` per dynamic segment in dependency order; static segments are never on this rail. It is enqueued by the business events on the rows the segment lens reads (`contact.*`, `organization.*`, `space.*`, `user.redacted`, `communication.settled`), never by a DB hook. `sweepSegments` (cron, seeded at 04:00 UTC) enqueues every sound dynamic segment in dependency order (`sweepableSegments`) and is the backstop for writes that bypass a service; a degraded segment never reaches the queue, from the sweep or from a recomputed segment's dependents fan-out. Both reconcile paths publish the junction diff as four events: `segment.membersAdded` / `segment.membersRemoved` (owner side) and `customerRef.segmentsAdded` / `customerRef.segmentsRemoved` (member side).

`RECONCILE_TRIGGERS` records coverage of the lens's reached models. The added handlers for
`customerRef.created`, `user.updated`, `tag.deleted`, `tagAttachment.created` and
`tagAttachment.deleted` still lack production emitters; the sweep remains the backstop.
See [SEGMENTS.md](SEGMENTS.md) for current behavior and the remaining work.

### rotateEncryptionKeys

Re-encrypts data from old encryption keys to current keys. Auto-enqueued on worker startup.

```typescript
// Auto-triggered on worker startup
await enqueueJob('rotateEncryptionKeys', undefined, {
  id: 'rotateEncryptionKeys'
});

// Manual trigger (admin endpoint)
POST /admin/jobs/enqueue
{
  "handlerName": "rotateEncryptionKeys",
  "payload": {},
  "options": { "id": "manual-rotation" }
}
```

| Feature | Detail |
|---------|--------|
| Auto-discovery | Iterates all models/keys in `ENCRYPTED_MODELS` registry |
| Version detection | Reads target versions from environment variables |
| Concurrency | Parallel processing with db concurrency limits |
| Idempotency | Version precondition prevents duplicate work |
| Singleton | Redis lock ensures only one rotation runs at a time |

See [ENCRYPTION.md](ENCRYPTION.md) for complete key rotation documentation.

---

## Creating Handlers

### 1. Define Handler

```typescript
// handlers/myJob.ts
import { makeJob } from '#/jobs/makeJob';

export type MyJobPayload = {
  userId: string;
  action: string;
};

export const myJob = makeJob<MyJobPayload>(async (ctx, payload) => {
  const { userId, action } = payload;

  ctx.log(`Processing ${action} for user ${userId}`);
  // Job logic here
  ctx.log('Completed');
});
```

### 2. Register in Index

```typescript
// handlers/index.ts
export const JobHandlerName = {
  sendWebhook: 'sendWebhook',
  myJob: 'myJob',
} as const;

export type JobPayloads = {
  sendWebhook: SendWebhookPayload;
  myJob: MyJobPayload;
};

export const jobHandlers = {
  sendWebhook,
  myJob,
};
```

---

## Handler Patterns

| Pattern | Use Case |
|---------|----------|
| `makeJob` | Basic job wrapper |
| `makeSingletonJob` | Redis lock prevents concurrent runs |
| `makeSupersedingJob` | Newer job cancels older with same key |

### ctx.log() - Dual-Write Logging

Job handlers have access to `ctx.log()` which writes to **both** stdout AND BullBoard:

```typescript
export const myJob = makeJob<MyPayload>(async (ctx, payload) => {
  ctx.log('Starting processing');  // → stdout + BullBoard job logs

  // ... process ...

  ctx.log(`Processed ${count} items`);
  ctx.log('Completed successfully');
});
```

Benefits:
- **Console visibility**: Standard stdout for local development and log aggregation
- **BullBoard history**: Stored with job in Redis, viewable in BullBoard UI
- **Correlation**: Both outputs share the same scope ID (`[worker][jobName:jobId]`)

**Note**: Use `ctx.log()` in job handlers instead of importing `log` directly from `@template/shared/logger`.

### Singleton Job

```typescript
export const dailyCleanup = makeSingletonJob(async (ctx, payload) => {
  // Only one instance runs at a time
});
```

### Superseding Job

Newer jobs with the same dedupe key cancel older running jobs.

```typescript
import { redisNamespace } from '@template/db';

export const syncData = makeSupersedingJob(
  async (ctx, payload) => {
    // Check ctx.signal.aborted periodically
    if (ctx.signal?.aborted) return;
  },
  // Dedupe key - use redisNamespace for consistency
  (payload) => `${redisNamespace.job}:sync:${payload.resourceId}`
);
```

How it works:
1. Enqueue/drain claims the lane: `claimLane(job:lane:{handler}:{dedupeKey}, jobId)` (last claim wins)
2. The running job's `watchLane` polls its lane (~500ms); a different holder means it was usurped
3. Usurped jobs abort via `ctx.signal` and exit gracefully

---

## Enqueuing Jobs

```typescript
import { enqueueJob } from '#/jobs/enqueue';

await enqueueJob('sendWebhook', {
  subscriptionId: sub.id,
  action: 'create',
  resourceId: record.id,
  data: record,
});

// With options
await enqueueJob('myJob', payload, {
  delay: 5000,        // Delay in ms
  priority: 1,        // Lower = higher priority
  attempts: 3,        // Retry attempts
  type: 'adhoc',      // 'cron' | 'cronTrigger' | 'adhoc' (default adhoc)
  lane: 'slow',       // 'fast' | 'slow' — overrides the handler's declared lane (see Fast and Slow Lanes)
  bypass: false,      // skip the overflow buffer — latency-critical jobs go straight to BullMQ
});
```

A custom `jobId` must satisfy BullMQ's rules (`validateJobId`): not `'0'`, no `'0:'` prefix, no `':'`. An invalid id throws at enqueue rather than being quarantined later.

When overflow is active, an `adhoc` enqueue returns `{ jobId, name, outboxed: true }` (spilled to the buffer) instead of adding to BullMQ directly. See [Overflow Buffer](#overflow-buffer).

In test (`isTest`), `enqueueJob` skips BullMQ entirely and runs the handler inline — cascading effects happen for real, errors propagate, no queue/overflow machinery involved. The inline job still receives the resolved envelope (lane included). To test routing, call `admitEnvelope` directly (see `jobs/tests/`).

---

## Fast and Slow Lanes

One large send is thousands of jobs on the same worker pool every other kind of work shares; in plain FIFO order, everything else waits behind it. Slow work instead waits in the same queue at the lowest priority, so fast work is always picked first; it runs in at most its share of each worker's slots, so the rest stay free for fast work; and it may fill only its share of the queue's depth budget.

### Choosing a Lane

A lane is a label on the job envelope (`JobData.lane`, next to `type`), not a kind of job. `buildJobData` resolves it once, where every producer builds the envelope: the request's lane, then the enqueue option, then the handler's declared default, then `fast`.

```typescript
export const bulkThing = makeJob<Payload>(async (ctx, payload) => { ... }, { lane: JobLane.slow });
```

A producer that knows the work's size sets the lane per enqueue instead — `sendEmail` puts its per-recipient `deliverEmail` fan-out on the slow lane when it has more than `EMAIL_SLOW_LANE_MIN_RECIPIENTS` recipients (`fanOutLane`), and keeps smaller sends fast. Every `queue.add` site stamps the lane (and the slow lane's priority): `enqueueJob`, `registerCronJobs`, the `cronJobSync` hook, and the drain. The superadmin enqueue (`options.lane`) and cron trigger (`{ lane }` body) accept an override. The worker reads only `job.data.lane`; an envelope with no lane (queued before lanes existed) is fast everywhere.

`makeSingletonJob` and `makeSupersedingJob` carry the wrapped handler's declared lane.

### Priority: Fast Work Is Always Picked First

BullMQ moves a job to active from the plain wait list first and from the prioritized set only when the wait list is empty. Slow jobs are added with `priority: SLOW_LANE_PRIORITY` (`2^21 - 1`, one below BullMQ's `PRIORITY_LIMIT`) by `withLanePriority` (`jobs/lanePriority.ts`), which every add site applies. BullMQ scores a prioritized job `priority × 2^32 + counter` in a Redis double; at `PRIORITY_LIMIT` that passes `2^53`, equal-priority jobs collide, and the slow lane loses its FIFO order. The admin enqueue caps `priority` at `SLOW_LANE_PRIORITY` for the same reason. So a fast job never queues behind a slow backlog, and a job given an explicit priority (the admin enqueue accepts one) is served after all unprioritized fast work and, below `SLOW_LANE_PRIORITY`, ahead of all slow work; at `SLOW_LANE_PRIORITY` it waits and counts as slow work. Within one priority BullMQ keeps FIFO order.

### Slots: Slow Work Uses at Most Its Share

Priority decides which job starts next, but BullMQ never preempts a running job, so ordering alone would let slow work fill every slot and make a fast job wait for a slow one to finish. Each worker therefore runs slow jobs in at most `JOBS_SLOW_SLOT_FRACTION` of its `JOBS_WORKER_CONCURRENCY` slots (at least one), counted by the worker's own `SlowSlotPool` (`jobs/slowSlotPool.ts`). When a slow job starts on a worker whose slow share is full, `admitToSlot` (`jobs/admitToSlot.ts`) parks it: it moves to delayed and returns to the slow band at its stored priority when it comes due. `moveToDelayed` skips the attempt count, so parking never uses up retries. The park is uniform between `SLOW_PARK_MIN_MS` (2 s) and a window that widens by 20 ms for each queued slow job, capped at `JOBS_SLOW_PARK_MAX_MS` (60 s), so refused jobs do not come due together and a large send is not refetched and refused every second. Each park counts `jobs.slow.parked`. The other slots stay free for fast work. Fast work is not capped: it may use every slot, including the slow share when no slow work is running.

`admitToSlot` also keeps a job at its priority when BullMQ does not. Stalled-job recovery and a manual retry (`job.retry()`, `queue.retryJobs()`, the Bull Board retry button) put a job on the plain wait list whatever its priority, ahead of all fast work. A job with a priority can legitimately start only when the plain wait list is empty, so a prioritized job that starts while fast work is waiting is moved back with `job.moveToWait`, which returns it to its priority band. Automatic retries and delayed promotion already keep the priority.

The slot share needs no shared state: every worker applies the same fraction to its own concurrency, so the fleet-wide share follows.

The slow slot is released in `processJob`'s `finally` however the handler ends, and a slow job's finish, success or failure, stamps the lane's idle clock (`recordSlowFinished`). A Redis error while stamping is logged and never fails the job.

### Pressure: One Budget, Divided by Lane

The overflow buffer's depth budget (`JOBS_MAX_QUEUE_DEPTH`) is shared by both lanes and counts everything waiting or running (`waiting + prioritized + active`) plus the slow jobs the lane deferred into `delayed`. Slow jobs — BullMQ's count for the slow priority band plus those deferred slow jobs — may fill only `JOBS_SLOW_QUEUE_DEPTH_FRACTION` of it. Each lane has its own overflow flag:

- **Fast** spills when the whole budget is full.
- **Slow** spills when its share is full, or when the whole budget is.

The drain refills fast rows up to the budget's free room, then slow rows up to what is left of both the budget and the slow share — batched, one read and one delete per lane per pass. Each lane's flag clears below its own low-water once none of its rows wait. Every slow row re-enters BullMQ at the slow priority.

#### The Deferral List

While the slot share has a send parked, nearly all of it sits in BullMQ's `delayed` set at any moment. A count that skipped `delayed` read a queued send as an empty lane: the drain admitted past the slow share and every signal read zero. But `delayed` cannot simply be counted — it also holds scheduled cron repeats, backoff retries and deliberately delayed fast jobs, and BullMQ keeps it as one set ordered by due time with no priority to count by.

So the slow lane keeps its own list of the slow jobs it put there (`jobs/slowLaneSignals.ts`): a Redis sorted set per queue, `job:<queue>:slow:deferred`, of job ids scored by due time. A job goes on it when `admitToSlot` parks it (recorded before `moveToDelayed`, so a parked job is never outside the count) or when a slow job is added with a delay (`admitEnvelope`, or the drain re-adding a delayed slow row), and comes off when a worker picks it back up — when `admitToSlot` admits it to a slow slot or sends it back as a line-jumper. Keyed by job id, so parking the same job again moves its score instead of counting it twice. The list is a signal, not part of delivery: a Redis error while writing it is logged and never fails or blocks the job.

It cannot go by due time: BullMQ promotes delayed jobs only when a worker fetches, and parked jobs were measured sitting in `delayed` 2–21 s past due, so a count by due-time band undercounts. An entry stays counted until a worker picks the job up; only one nobody picks up within `SLOW_DEFERRED_GRACE_MS` (five minutes) of its due time — a delayed job deleted by hand, say — stops counting, and the drain pass prunes it. The depth probe caps the list at BullMQ's own `delayed` count, because a listed job that was promoted and is waiting to be fetched is in the slow band too.

#### Slow-Lane Signals

The worker registers three observable gauges beside `messaging.queue.messages`, read from one snapshot (`readSlowLaneState`):

- `jobs.slow.queued` — the slow band plus the deferred slow jobs: the number the slow share is enforced against.
- `jobs.slow.deferred` — the deferred part alone: jobs parked by the slot share and delayed slow adds.
- `jobs.slow.idle_ms` — how long slow work has been queued without a slow job finishing. It is 0 while nothing slow is queued (reading it then clears the stamp, so the next send's clock starts when its work is first seen, not at a finish from an earlier send). A draining send keeps it near one job's duration; a climbing value while `jobs.slow.queued` is above 0 is a slow lane that is not moving — hung handlers, or no workers — which the queue depth alone cannot tell apart from a large send draining normally.

The counter `jobs.slow.parked` counts refusals by the slot share. The drain pass reads the same snapshot at the end of every pass, so the flag-settling decisions use the same depths the gauges show and the idle clock advances every ~2 s.

### Lane Configuration

Defined in the env schema (`apps/api/src/config/env.ts`) with defaults in `apps/api/.env.local.example`:

| Env var | Default | Description |
|---------|---------|-------------|
| `JOBS_WORKER_CONCURRENCY` | `10` | BullMQ worker concurrency |
| `JOBS_SLOW_SLOT_FRACTION` | `0.5` | Share of each worker's slots slow jobs may run in (at least one) |
| `JOBS_SLOW_QUEUE_DEPTH_FRACTION` | `0.5` | Share of `JOBS_MAX_QUEUE_DEPTH` slow jobs may fill before spilling |
| `JOBS_SLOW_PARK_MAX_MS` | `60000` | Longest park for a slow job refused by a full slot share (min `1000`); parks start at 2 s and widen by 20 ms per queued slow job |
| `EMAIL_SLOW_LANE_MIN_RECIPIENTS` | `25` | `sendEmail` fan-outs wider than this are slow |

### Validating Against Real Infrastructure

`apps/api/scripts/slowLaneCheck.ts` runs the whole path against real Redis, a real BullMQ worker pair, and Postgres, and exits non-zero on any failure. It enqueues a slow send of multi-second jobs through `enqueueJob`, waits until slow work fills its slot share, then injects fast jobs and asserts that slow work ran in exactly its share of slots and never more, that fast jobs started within `SLOW_LANE_CHECK_FAST_WAIT_MS` (p95), and that every slow job ran once. It then spills a send larger than the slow share (`SLOW_LANE_CHECK_SEND_JOBS`, 200, of `SLOW_LANE_CHECK_SEND_JOB_MS`, 5 s) to `JobOutbox` and lets the real drain loop meter it in. Every 250 ms it compares the slow count the lane enforces (`queueDepths().slow`) with the slow jobs actually in Redis (`prioritized + delayed`), and it counts parks from the queue's `delayed` events. It fails if the send does not exceed the share, if the drain lets more than 110% of the slow share into Redis, if the signal reads under 0.8 or over 1.25 of the truth, if a queued slow job is parked more than 1.1× once per `SLOW_PARK_MIN_MS`, if the slow slots are busy less than 80% of the send (parked jobs coming back too late leave slots idle), or if a payload is lost or runs twice. A hung-handler case holds one slow slot for 3 s with five slow jobs queued and fails unless `jobs.slow.idle_ms` reads at least 80% of the hang, never more queued than jobs exist, and 0 once the lane empties. It also checks that 200 jobs at `SLOW_LANE_PRIORITY` keep distinct scores and FIFO order (reporting the collision at `PRIORITY_LIMIT` beside it), and that a manually retried slow job runs after waiting fast work with its priority intact. Its polling loops stop through a shared object (`loops.isRunning`), never a captured `let` — under Bun a loop was observed reading a captured `let` flag stale for 30 s — and every teardown await runs under a 30 s deadline. It obliterates the queue and empties `JobOutbox`, so it refuses to run without `ENVIRONMENT=local` and `SLOW_LANE_CHECK_CONFIRM=wipe`:

```bash
bun run with test api env ENVIRONMENT=local SLOW_LANE_CHECK_CONFIRM=wipe \
  REDIS_URL=redis://localhost:6379/9 REDIS_BULLMQ_URL=redis://localhost:6379/9 JOBS_MAX_QUEUE_DEPTH=200 \
  bun apps/api/scripts/slowLaneCheck.ts
```

Point `REDIS_URL` at your own Redis (`REDIS_PORT` in the root `.env`). `SLOW_LANE_CHECK_JOBS`, `SLOW_LANE_CHECK_JOB_MS`, `SLOW_LANE_CHECK_WORKERS`, `SLOW_LANE_CHECK_FAST_WAIT_MS`, `SLOW_LANE_CHECK_SEND_JOBS`, and `SLOW_LANE_CHECK_SEND_JOB_MS` vary the run. Setting `JOBS_SLOW_SLOT_FRACTION=1` removes the reservation and the fast-wait assertion fails.

---

## Overflow Buffer

A durable buffer in front of BullMQ. When queue depth crosses a cap, an overflow flag flips and `adhoc` enqueues spill to the `JobOutbox` DB table instead of Redis; a per-worker drain loop meters them back in as room frees up. Source: `apps/api/src/jobs/outbox/`.

`JobOutbox` rows persist the full re-enqueue intent: `handlerName`, a unique `jobId` (idempotent re-enqueue), `dedupeKey` (superseding lane; null for plain fan-out), `lane` (each lane waits for room in its own share of the depth budget — mirrors `data.lane`), `data` (`JobData`), `options` (`JobOptions`), and a drain-local `attempts` counter (distinct from `options.attempts`). The `id` is a time-ordered uuidv7, so `orderBy: { id: 'asc' }` is FIFO drain order.

### Spill Routing

`shouldSpill(type, bypass, overflowing)` is a pure predicate: spill only when `type === 'adhoc' && !bypass && overflowing`. Cron and cronTrigger jobs always go direct — only `adhoc` jobs are ever buffered. On a direct `adhoc` add, `tripIfFull()` flips the flag if that add crossed the cap (fresh, uncached probe to avoid overshoot on a ramp).

### Accumulator

`spillToOutbox` routes every spill (fan-out and superseding) through an in-memory accumulator that batches DB writes:

- Flush triggers: size (`flushMaxRows`, default 1000) flushes inline; otherwise a `flushLinger` timer (default 200ms) arms for the partial tail.
- Within a batch, superseding lanes (`handlerName`+`dedupeKey`) collapse to the latest row (`dedupeLatestPerLane`); null-`dedupeKey` rows are all kept.
- One txn per flush: plain rows via `createManyAndReturn({ skipDuplicates })`, superseding lanes via `upsert` (last-writer-wins, no silent drop).
- Resolves on COMMIT, never on accumulation — a crash in the flush window must not drop a job.
- `flushOutbox()` is the shutdown drain: called after intake stops, it persists every buffered row with retry (`SHUTDOWN_FLUSH_RETRIES`) and surfaces failures loudly.

### Drain Loop

`startOutboxDrainLoop()` / `stopOutboxDrainLoop()` run a per-worker, in-process `setInterval` every ~2s (not a queued cron). Each tick (`runDrainOutboxPass`) runs under a Redis lock (`createLock`, `service: 'outbox-drain'`) so only one worker drains at a time, and the NX acquire skips a tick whose predecessor is still running. The interval is short so a lane whose share empties quickly — many short slow jobs — is refilled before its slots sit idle; a pass with nothing buffered is a lock attempt and a job-count read.

A pass:
1. Reads the lane depths (`queueDepths`). Fetches up to the budget's free room of non-quarantined **fast** rows oldest-first (FIFO) and re-enqueues them, re-claiming the supersede lane first when `dedupeKey` is set. A stored job id BullMQ would reject is replaced with a fresh one rather than failing forever.
2. Does the same for **slow** rows, up to what is left of the budget and of the slow share, re-adding each at the slow priority.
3. Deletes drained rows per lane in one statement; increments `attempts` on rows that failed re-enqueue. After `MAX_DRAIN_ATTEMPTS` (5) failures a row is quarantined (skipped) so a poison row at the head can't starve newer rows.
4. Reads the slow-lane snapshot (`readSlowLaneState`: prunes the deferral list, fresh lane depths, idle clock). Under the outbox mutex: clears each lane's flag once that lane is below its own low-water with no admittable row and no pending spill of that lane; resets quarantined rows to `attempts: 0` only when the queue is below low-water and neither lane has an admittable row or a pending spill.

The whole pass runs inside `withOverflowRenew` so a long pass can't let either flag's TTL lapse mid-tick.

### Overflow Flag

One Redis key per lane — `job:overflow` (the whole budget) and `job:overflow:slow` (the slow share) — value = epoch ms when overflow began:

- Set-once via `NX` so re-trips keep the original start time (used by the stuck-overflow alert).
- Carries a TTL the drain renews each tick (`renewOverflow` / `withOverflowRenew` heartbeat) — survives between ticks, self-clears if the drain dies.
- `warnIfOverflowStuck` logs when overflow has persisted past `overflowStuckMs` (drain not keeping up with arrivals).

### Queue Depth Probe

`queueDepths()` returns `{ total, slow, slowDeferred }`: `slowDeferred` is the slow lane's deferral list capped at BullMQ's `delayed` count (see [The Deferral List](#the-deferral-list)); `total` counts `waiting + prioritized + active + slowDeferred`; `slow` counts the jobs waiting at `SLOW_LANE_PRIORITY` via BullMQ's `getCountsPerPriority` plus `slowDeferred`. The rest of `delayed` stays out — scheduled cron repeats and backoff retries are a standing floor, not pressure. Cached ~1s (`DEPTH_CACHE_MS`). Pass `fresh = true` to bypass the cache (used by `tripIfFull` and the drain). A job given an explicit priority between the lanes lands in `prioritized` and counts against the whole budget, not the slow share.

All `JobOutbox` writes — accumulator flushes AND the drain — run through one shared serialized queue (`flushQueue` / `runOnOutboxQueue`, via `createSerializedQueue`), so a flush and a drain can never touch the table concurrently.

### Overflow Configuration

Defined in the env schema (`apps/api/src/config/env.ts`), read lazily through `outbox/config.ts`. In tests, `setEnvOverride` values for these knobs are parsed through the same schema fields (an invalid override keeps the parsed default):

| Env var | Default | Description |
|---------|---------|-------------|
| `JOBS_MAX_QUEUE_DEPTH` | `10000` | Depth cap that trips overflow |
| (derived) | `0.8 × cap` | Low-water mark for clearing |
| `JOBS_OUTBOX_FLUSH_MAX_ROWS` | `1000` | Accumulator size-flush threshold |
| `JOBS_OUTBOX_FLUSH_LINGER_MS` | `200` | Accumulator partial-batch linger |
| `JOBS_OVERFLOW_TTL_MS` | `60000` | Flag TTL (drain heartbeats it) |
| `JOBS_OVERFLOW_STUCK_MS` | `300000` | Age before stuck-overflow warning |

---

## Cron Jobs

Stored in DB, registered on worker startup.

### Cron Patterns (UTC)

All cron patterns run in **UTC timezone**. Examples:

| Pattern | Schedule (UTC) |
|---------|----------------|
| `0 0 * * *` | Daily at midnight |
| `0 */6 * * *` | Every 6 hours |
| `0 9 * * 1-5` | Weekdays at 9am |
| `*/15 * * * *` | Every 15 minutes |

### CronJob Model

| Field | Description |
|-------|-------------|
| `jobId` | BullMQ idempotency key (prevents duplicate registrations) |
| `name` | Human readable name (unique) |
| `description` | Optional description of what the job does |
| `pattern` | Cron expression (UTC) |
| `handler` | Handler name from registry |
| `payload` | JSON data for handler |
| `enabled` | Toggle on/off |
| `maxAttempts` | Retry attempts on failure |
| `backoffMs` | Exponential backoff base delay |
| `createdById` | Optional FK to User who created the job |

### Admin Routes

```
# Ad-hoc Jobs
POST   /api/admin/job              # Enqueue ad-hoc job (options.lane overrides the lane)

# Cron Jobs
GET    /api/admin/cronJob          # List all
POST   /api/admin/cronJob          # Create
GET    /api/admin/cronJob/:id      # Read one
PATCH  /api/admin/cronJob/:id      # Update
DELETE /api/admin/cronJob/:id      # Delete
POST   /api/admin/cronJob/:id/trigger  # Run immediately (optional body { lane })
```

### JobType Values

| Type | Description |
|------|-------------|
| `cron` | Scheduled by BullMQ repeater |
| `cronTrigger` | Manually triggered cron |
| `adhoc` | One-off job |

`type` gates overflow routing: only `adhoc` jobs ever spill to the buffer; `cron`/`cronTrigger` always go direct to BullMQ. See [Overflow Buffer](#overflow-buffer).

---

## BullBoard

Web UI for monitoring and managing BullMQ jobs at `/bullBoard`.

### Access

| Environment | Auth | URL |
|-------------|------|-----|
| Local | None required | `http://localhost:8000/bullBoard` |
| Non-local | Basic auth required | Requires credentials |

### Configuration

```env
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=secret
```

### Error Boundaries

**BullBoard:**
| Scenario | Behavior |
|----------|----------|
| Local, no credentials | Enabled without auth |
| Non-local, no credentials | Disabled (logs warning) |
| Non-local, with credentials | Enabled with basic auth |

**Job Worker:**
| Scenario | Behavior |
|----------|----------|
| Unknown handler name | Logs error, throws (job fails) |
| Handler throws | Logs error, re-throws (BullMQ retries based on `attempts`) |
| Test environment | Worker skipped entirely |
| Graceful shutdown | Waits for active jobs, closes connections |

### Features

- View all queues and jobs
- Monitor job status (waiting, active, completed, failed)
- Inspect job data and errors
- Retry failed jobs
- Clean completed/failed jobs
- Pause/resume queues
