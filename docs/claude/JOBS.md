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
├── buildJobData.ts     # The one job-data envelope every producer builds (lane resolved here)
├── enqueue.ts          # enqueueJob function
├── lanePriority.ts     # Slow lane → lowest BullMQ priority
├── makeJob.ts          # Job wrapper constructors
├── processJob.ts       # Per-job processor: scopes, tracing, lane dispatch
├── queue.ts            # BullMQ queue setup
├── registerCronJobs.ts # Cron registration on worker startup
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

One large send is thousands of jobs on the same worker pool every other kind of work shares; in plain FIFO order, everything else waits behind it. Slow work instead waits in the same queue at the lowest priority, so any idle slot runs it and fast work always goes first, and it may fill only its share of the queue's depth budget. Capacity stays shared: with no fast work waiting, every slot runs slow work.

### Choosing a Lane

A lane is a label on the job envelope (`JobData.lane`, next to `type`), not a kind of job. `buildJobData` resolves it once, where every producer builds the envelope: the request's lane, then the enqueue option, then the handler's declared default, then `fast`.

```typescript
export const bulkThing = makeJob<Payload>(async (ctx, payload) => { ... }, { lane: JobLane.slow });
```

A producer that knows the work's size sets the lane per enqueue instead — `sendEmail` puts its per-recipient `deliverEmail` fan-out on the slow lane when it has more than `EMAIL_SLOW_LANE_MIN_RECIPIENTS` recipients (`fanOutLane`), and keeps smaller sends fast. Every `queue.add` site stamps the lane (and the slow lane's priority): `enqueueJob`, `registerCronJobs`, the `cronJobSync` hook, and the drain. The superadmin enqueue (`options.lane`) and cron trigger (`{ lane }` body) accept an override. The worker reads only `job.data.lane`; an envelope with no lane (queued before lanes existed) is fast everywhere.

`makeSingletonJob` and `makeSupersedingJob` carry the wrapped handler's declared lane.

### Priority: Fast Work Is Always Picked First

BullMQ moves a job to active from the plain wait list first and from the prioritized set only when the wait list is empty. Slow jobs are added with `priority: SLOW_LANE_PRIORITY` (BullMQ's `PRIORITY_LIMIT`, the lowest priority it allows) by `withLanePriority` (`jobs/lanePriority.ts`), which every add site applies. So a fast job never queues behind a slow backlog — it waits at most for the next slot to free, roughly half of one slow job's duration — and any job given an explicit priority still ranks ahead of slow work. Within the slow lane BullMQ keeps FIFO order.

There is no slot cap: a slow job that starts always runs. The cost is that a fast job arriving while every slot holds a slow job waits for one to finish, which is short for per-recipient work (hundreds of ms) and long for multi-second handlers — keep slow handlers short.

### Pressure: One Budget, Divided by Lane

The overflow buffer's depth budget (`JOBS_MAX_QUEUE_DEPTH`) is shared by both lanes and counts everything waiting or running (`waiting + prioritized + active`). Slow jobs — BullMQ's `prioritized` count — may fill only `JOBS_SLOW_QUEUE_DEPTH_FRACTION` of it. Each lane has its own overflow flag:

- **Fast** spills when the whole budget is full.
- **Slow** spills when its share is full, or when the whole budget is.

The drain refills fast rows up to the budget's free room, then slow rows up to what is left of both the budget and the slow share — batched, one read and one delete per lane per pass. Each lane's flag clears below its own low-water once none of its rows wait. Every slow row re-enters BullMQ at the slow priority.

### Lane Configuration

Defined in the env schema (`apps/api/src/config/env.ts`) with defaults in `apps/api/.env.local.example`:

| Env var | Default | Description |
|---------|---------|-------------|
| `JOBS_WORKER_CONCURRENCY` | `10` | BullMQ worker concurrency |
| `JOBS_SLOW_QUEUE_DEPTH_FRACTION` | `0.5` | Share of `JOBS_MAX_QUEUE_DEPTH` slow jobs may fill before spilling |
| `EMAIL_SLOW_LANE_MIN_RECIPIENTS` | `25` | `sendEmail` fan-outs wider than this are slow |

### Validating Against Real Infrastructure

`apps/api/scripts/slowLaneCheck.ts` runs the whole path against real Redis, a real BullMQ worker pair, and Postgres: it enqueues a large slow send through `enqueueJob`, injects fast jobs mid-send, and reports fast-job start latency, peak slow jobs held in the queue against their share, how many spilled to the outbox, completions, duplicates, and losses. Set a small `JOBS_MAX_QUEUE_DEPTH` to exercise the spill-and-drain path. It obliterates the queue and empties `JobOutbox`, so it refuses to run without `ENVIRONMENT=local` and `SLOW_LANE_CHECK_CONFIRM=wipe`:

```bash
bun run with test api env ENVIRONMENT=local SLOW_LANE_CHECK_CONFIRM=wipe \
  REDIS_URL=redis://localhost:6379/9 REDIS_BULLMQ_URL=redis://localhost:6379/9 JOBS_MAX_QUEUE_DEPTH=600 \
  bun apps/api/scripts/slowLaneCheck.ts
```

`SLOW_LANE_CHECK_JOBS`, `SLOW_LANE_CHECK_JOB_MS`, and `SLOW_LANE_CHECK_WORKERS` vary the run.

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
4. Under the outbox mutex: clears each lane's flag once that lane is below its own low-water with no admittable row and no pending spill of that lane; resets quarantined rows to `attempts: 0` only when the queue is below low-water and neither lane has an admittable row or a pending spill.

The whole pass runs inside `withOverflowRenew` so a long pass can't let either flag's TTL lapse mid-tick.

### Overflow Flag

One Redis key per lane — `job:overflow` (the whole budget) and `job:overflow:slow` (the slow share) — value = epoch ms when overflow began:

- Set-once via `NX` so re-trips keep the original start time (used by the stuck-overflow alert).
- Carries a TTL the drain renews each tick (`renewOverflow` / `withOverflowRenew` heartbeat) — survives between ticks, self-clears if the drain dies.
- `warnIfOverflowStuck` logs when overflow has persisted past `overflowStuckMs` (drain not keeping up with arrivals).

### Queue Depth Probe

`queueDepths()` returns `{ total, slow }`: `total` counts `waiting + prioritized + active`, `slow` counts `prioritized` (NOT `delayed` — scheduled cron repeats are a standing floor, not pressure), cached ~1s (`DEPTH_CACHE_MS`). Pass `fresh = true` to bypass the cache (used by `tripIfFull` and the drain). A job given an explicit priority also lands in `prioritized` and counts against the slow share.

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
