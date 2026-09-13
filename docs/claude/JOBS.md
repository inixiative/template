# Jobs

<!-- toc:start -->

## Contents

- [Job System](#job-system)
  - [Worker Configuration](#worker-configuration)
  - [Job IDs](#job-ids)
- [Built-in Handlers](#built-in-handlers)
  - [sendWebhook](#sendwebhook)
  - [rotateEncryptionKeys](#rotateencryptionkeys)
- [Creating Handlers](#creating-handlers)
  - [1. Define Handler](#1-define-handler)
  - [2. Register in Index](#2-register-in-index)
- [Handler Patterns](#handler-patterns)
  - [ctx.log() - Dual-Write Logging](#ctxlog---dual-write-logging)
  - [Singleton Job](#singleton-job)
  - [Superseding Job](#superseding-job)
- [Enqueuing Jobs](#enqueuing-jobs)
- [Overflow Buffer](#overflow-buffer)
  - [Spill Routing](#spill-routing)
  - [Accumulator](#accumulator)
  - [Drain Loop](#drain-loop)
  - [Overflow Flag](#overflow-flag)
  - [Queue Depth Probe](#queue-depth-probe)
  - [Configuration](#overflow-configuration)
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
│   ├── config.ts       # Caps, linger, TTLs (env-overridable)
│   ├── flag.ts         # Redis overflow flag (set-once + TTL/heartbeat)
│   ├── mutex.ts        # Serialized queue shared by flush + drain
│   ├── queueDepth.ts   # Cached waiting+active depth probe
│   └── types.ts        # OutboxRow + shouldSpill
├── enqueue.ts          # enqueueJob function
├── makeJob.ts          # Job wrapper constructors
├── queue.ts            # BullMQ queue setup
├── registerCronJobs.ts # Cron registration on worker startup
├── types.ts            # Type definitions
└── worker.ts           # Worker entry point
```

### Worker Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Concurrency | 10 | Max parallel jobs |
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
  bypass: false,      // skip the overflow buffer — latency-critical jobs go straight to BullMQ
});
```

When overflow is active, an `adhoc` enqueue returns `{ jobId, name, outboxed: true }` (spilled to the buffer) instead of adding to BullMQ directly. See [Overflow Buffer](#overflow-buffer).

In test (`isTest`), `enqueueJob` skips BullMQ entirely and runs the handler inline — cascading effects happen for real, errors propagate, no queue/overflow machinery involved.

---

## Overflow Buffer

A durable buffer in front of BullMQ. When queue depth crosses a cap, an overflow flag flips and `adhoc` enqueues spill to the `JobOutbox` DB table instead of Redis; a per-worker drain loop meters them back in as room frees up. Source: `apps/api/src/jobs/outbox/`.

`JobOutbox` rows persist the full re-enqueue intent: `handlerName`, a unique `jobId` (idempotent re-enqueue), `dedupeKey` (superseding lane; null for plain fan-out), `data` (`JobData`), `options` (`JobOptions`), and a drain-local `attempts` counter (distinct from `options.attempts`). The `id` is a time-ordered uuidv7, so `orderBy: { id: 'asc' }` is FIFO drain order.

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

`startOutboxDrainLoop()` / `stopOutboxDrainLoop()` run a per-worker, in-process `setInterval` every ~15s (not a queued cron). Each tick (`runDrainOutboxPass`) runs under a Redis lock (`createLock`, `service: 'outbox-drain'`) so only one worker drains at a time, and the NX acquire skips a tick whose predecessor is still running.

A pass:
1. Computes room (`maxQueueDepth − queueDepth`); if room > 0, fetches up to `room` non-quarantined rows oldest-first (FIFO) and re-enqueues them, re-claiming the supersede lane first when `dedupeKey` is set.
2. Deletes drained rows; increments `attempts` on rows that failed re-enqueue.
3. After `MAX_DRAIN_ATTEMPTS` (5) re-enqueue failures a row is quarantined (skipped) so a poison row at the head can't starve newer rows.
4. Clears the flag only when depth drops below low-water AND no admittable backlog remains (else a fresh enqueue would jump the buffered FIFO); quarantined rows are reset to `attempts: 0` at clear time.

The whole pass runs inside `withOverflowRenew` so a long pass can't let the flag's TTL lapse mid-tick.

### Overflow Flag

A single global Redis key (value = epoch ms when overflow began):

- Set-once via `NX` so re-trips keep the original start time (used by the stuck-overflow alert).
- Carries a TTL the drain renews each tick (`renewOverflow` / `withOverflowRenew` heartbeat) — survives between ticks, self-clears if the drain dies.
- `warnIfOverflowStuck` logs when overflow has persisted past `overflowStuckMs` (drain not keeping up with arrivals).

### Queue Depth Probe

`queueDepth()` counts `waiting + active` (NOT `delayed` — scheduled cron repeats are a standing floor, not pressure), cached ~1s (`DEPTH_CACHE_MS`). Pass `fresh = true` to bypass the cache (used by `tripIfFull` and the drain).

All `JobOutbox` writes — accumulator flushes AND the drain — run through one shared serialized queue (`flushQueue` / `runOnOutboxQueue`, via `createSerializedQueue`), so a flush and a drain can never touch the table concurrently.

### Overflow Configuration

Read lazily (overridable per process / in tests), not frozen at import:

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
POST   /api/admin/job              # Enqueue ad-hoc job

# Cron Jobs
GET    /api/admin/cronJob          # List all
POST   /api/admin/cronJob          # Create
GET    /api/admin/cronJob/:id      # Read one
PATCH  /api/admin/cronJob/:id      # Update
DELETE /api/admin/cronJob/:id      # Delete
POST   /api/admin/cronJob/:id/trigger  # Run immediately
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
