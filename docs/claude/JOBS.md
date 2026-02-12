# Jobs

## Contents

- [Job System](#job-system)
- [Creating Handlers](#creating-handlers)
- [Handler Patterns](#handler-patterns)
- [Enqueuing Jobs](#enqueuing-jobs)
- [Cron Jobs](#cron-jobs)
- [BullBoard](#bullboard)

---

## Job System

BullMQ-based background jobs in `apps/api/src/jobs/`.

```
jobs/
├── handlers/
│   ├── index.ts        # Registry of all handlers
│   └── sendWebhook.ts  # Individual handler
├── enqueue.ts          # enqueueJob function
├── queue.ts            # BullMQ queue setup
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

| Scenario | ID Source |
|----------|-----------|
| Ad-hoc job (no dedupeKey) | BullMQ auto-generates |
| Superseding job | Uses `dedupeKey` as `jobId` (prevents duplicates) |
| Cron job | Uses `cronJob.jobId` from DB (idempotency key) |

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
1. New job enqueued → signals all matching jobs via `job:superseded:{jobId}` Redis key
2. Running jobs poll for supersede flag every 500ms
3. Superseded jobs abort via `ctx.signal` and exit gracefully

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
});
```

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
