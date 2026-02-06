# Batch API

Execute multiple API requests in a single HTTP call with transaction support, interpolation, and flexible failure handling.

## Contents

- [Overview](#overview)
- [Basic Usage](#basic-usage)
- [Execution Strategies](#execution-strategies)
- [Request Interpolation](#request-interpolation)
- [Status Tracking](#status-tracking)
- [Security](#security)
- [Implementation Patterns](#implementation-patterns)

---

## Overview

The Batch API allows clients to:
- Execute multiple requests in a single HTTP call
- Choose transaction vs non-transaction strategies
- Interpolate values from previous round results
- Handle failures gracefully or atomically

**Endpoint:** `POST /api/v1/batch/execute`

**Key Features:**
- 4 execution strategies with different failure semantics
- Request interpolation using `<<roundIndex.requestIndex.path>>` syntax
- Detailed status tracking (success/partialSuccess/failed)
- Security validations (no nested batches, absolute URLs blocked)
- Configurable timeouts based on request count

---

## Basic Usage

```typescript
const response = await fetch('/api/v1/batch/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    strategy: 'allowFailures', // required
    requests: [               // array of rounds
      [                        // round 0: parallel requests
        { method: 'GET', path: '/api/v1/me' },
        { method: 'GET', path: '/api/v1/me/organizations' }
      ],
      [                        // round 1: runs after round 0
        { method: 'GET', path: '/api/v1/me/spaces' }
      ]
    ],
    headers: {                 // optional: shared headers for all requests
      'X-Custom-Header': 'value'
    }
  })
});

const { data } = await response.json();
console.log(data.summary.status); // 'success' | 'partialSuccess' | 'failed'
console.log(data.batch);           // Array of round results
```

**Response Structure:**
```typescript
{
  data: {
    batch: [                    // Array of rounds
      [                         // Round 0 results
        { status: 200, body: { data: {...} } },
        { status: 200, body: { data: {...} } }
      ],
      [                         // Round 1 results
        { status: 200, body: { data: {...} } }
      ]
    ],
    summary: {
      totalRounds: 2,
      completedRounds: 2,
      totalRequests: 3,
      successfulRequests: 3,
      failedRequests: 0,
      strategy: 'allowFailures',
      status: 'success'         // Overall outcome
    }
  }
}
```

---

## Execution Strategies

Choose a strategy based on your transaction and failure handling needs.

### transactionAll

**Use when:** All operations must succeed or rollback together (atomic operation)

**Behavior:**
- Wraps all rounds in a single database transaction
- Any failure rolls back everything
- Best for: Creating related entities that must coexist

**Status outcomes:**
- `success` - All requests succeeded
- `failed` - Any request failed (all changes rolled back)

```typescript
// Example: Create organization + first user atomically
{
  strategy: 'transactionAll',
  requests: [
    [{ method: 'POST', path: '/api/v1/organization', body: {...} }],
    [{ method: 'POST', path: '/api/v1/organization/<<0.0.body.data.id>>/users', body: {...} }]
  ]
}
```

### transactionPerRound

**Use when:** Each round should be atomic, but previous rounds can stay committed

**Behavior:**
- Each round runs in its own transaction
- Round N+1 can use data from committed round N
- Earlier rounds stay committed even if later rounds fail
- Best for: Multi-step workflows where partial progress is acceptable

**Status outcomes:**
- `success` - All rounds succeeded
- `failed` - First round failed (no progress made)
- `partialSuccess` - Some rounds succeeded before failure

```typescript
// Example: Create resources in stages
{
  strategy: 'transactionPerRound',
  requests: [
    [{ method: 'POST', path: '/api/v1/organization', body: {...} }],  // Committed
    [{ method: 'POST', path: '/api/v1/space', body: {...} }],          // Committed
    [{ method: 'GET', path: '/api/v1/invalid' }]                       // Fails, but above stay
  ]
}
```

### allowFailures

**Use when:** You want to attempt all requests regardless of failures

**Behavior:**
- Continues executing all rounds even if requests fail
- No transactions - each request commits independently
- Completes all rounds before returning
- Best for: Bulk operations where some failures are expected

**Status outcomes:**
- `success` - All requests succeeded
- `failed` - All requests failed (100% failure rate)
- `partialSuccess` - Some succeeded, some failed

```typescript
// Example: Bulk delete (some might already be deleted)
{
  strategy: 'allowFailures',
  requests: [
    [
      { method: 'DELETE', path: '/api/v1/resource/id1' },
      { method: 'DELETE', path: '/api/v1/resource/id2' },
      { method: 'DELETE', path: '/api/v1/resource/id3' }
    ]
  ]
}
```

### failOnRound

**Use when:** Stop on first failure but return partial results

**Behavior:**
- Executes rounds sequentially
- Stops after first round containing failures
- Completes all requests in the failing round before stopping
- No transactions - requests commit as they succeed
- Best for: Sequential operations where later steps depend on earlier success

**Status outcomes:**
- `success` - All requests succeeded
- `failed` - All requests failed (100% failure rate)
- `partialSuccess` - Some succeeded before stopping

```typescript
// Example: Setup workflow that should stop on failure
{
  strategy: 'failOnRound',
  requests: [
    [{ method: 'POST', path: '/api/v1/organization', body: {...} }],  // Runs
    [{ method: 'GET', path: '/api/v1/invalid' }],                     // Fails, stops here
    [{ method: 'POST', path: '/api/v1/space', body: {...} }]          // Never runs
  ]
}
```

---

## Request Interpolation

Reference values from previous round results using `<<roundIndex.requestIndex.path>>` syntax.

### Syntax

```
<<roundIndex.requestIndex.bodyPath>>
```

- `roundIndex`: Which round (0-based)
- `requestIndex`: Which request within that round (0-based)
- `bodyPath`: Dot-notation path into response body

### Examples

```typescript
{
  requests: [
    // Round 0: Create organization
    [
      {
        method: 'POST',
        path: '/api/v1/organization',
        body: { name: 'Acme Corp', slug: 'acme' }
      }
    ],
    // Round 1: Use organization ID from round 0
    [
      {
        method: 'POST',
        path: '/api/v1/organization/<<0.0.body.data.id>>/users',
        body: { email: 'user@acme.com' }
      }
    ]
  ]
}
```

**Interpolation in:**
- `path` - Most common use case
- `body` fields - Can interpolate into request body values
- `headers` - Can interpolate into header values

### Security Validations

Interpolation syntax is validated to prevent:
- Nested interpolation: `<<0.0.body.data.<<1.0.id>>>>` ❌
- Current/future round references: `<<1.0.id>>` from round 1 ❌
- Malformed syntax: `<<invalid>>` ❌

---

## Status Tracking

Every batch response includes a `summary.status` field indicating overall outcome.

### Status Values

| Status | Meaning |
|--------|---------|
| `success` | All requests succeeded (100% success rate) |
| `partialSuccess` | Some succeeded, some failed (mixed results) |
| `failed` | All requests failed OR no progress made (100% failure or 0% completion) |

### Strategy-Specific Behavior

| Strategy | Success | Partial Success | Failed |
|----------|---------|-----------------|--------|
| **transactionAll** | All succeeded | ❌ Not possible | Any failed (all rolled back) |
| **transactionPerRound** | All rounds succeeded | Some rounds succeeded | First round failed (no progress) |
| **allowFailures** | All succeeded | Some succeeded | All failed |
| **failOnRound** | All succeeded | Some succeeded before stopping | All failed |

### Reading Status

```typescript
const { data } = await response.json();

// Always 200 HTTP status - check payload status
if (data.summary.status === 'success') {
  // All operations succeeded
} else if (data.summary.status === 'partialSuccess') {
  // Some succeeded - check individual results
  console.log(`${data.summary.successfulRequests}/${data.summary.totalRequests} succeeded`);
} else {
  // All failed or no progress made
  console.error('Batch operation failed');
}

// Inspect individual request results
data.batch.forEach((round, roundIndex) => {
  round.forEach((result, reqIndex) => {
    if (result.error) {
      console.error(`Round ${roundIndex}, Request ${reqIndex} failed:`, result.error);
    }
  });
});
```

### HTTP Status Code Semantics

**Key principle:** Batch operations always return `200 OK` with detailed results in payload.

**Rationale:**
- Batch operations are complex multi-request operations
- Single HTTP status code cannot represent mixed outcomes
- Clients must inspect detailed results anyway
- Clear separation: HTTP status (batch succeeded) vs payload status (request outcomes)

**Exception:** Only returns non-200 for:
- `400` - Invalid batch request syntax (validation failure)
- `400` - Nested batch request attempt (security violation)
- `500` - Unexpected server error (not request failures)

---

## Security

### Singleton Pattern

Batch requests cannot be nested:

```typescript
// ❌ This will return 400
fetch('/api/v1/batch/execute', {
  body: JSON.stringify({
    requests: [
      [{ method: 'POST', path: '/api/v1/batch/execute', ... }] // Rejected
    ]
  })
});
```

Detection: Requests with `X-Batch-Id` header are rejected.

### Absolute URL Protection

```typescript
// ❌ This will fail with 500 error in result
{
  requests: [
    [{ method: 'GET', path: 'https://evil.com/api' }] // Blocked
  ]
}
```

Only relative paths are allowed.

### Limits

```typescript
{
  requests: [
    // Max 10 rounds
    Array(11).fill([...]) // ❌ Rejected with 400
  ]
}

{
  requests: [
    [
      // Max 50 requests per round
      Array(51).fill({ method: 'GET', path: '...' }) // ❌ Rejected with 400
    ]
  ]
}

// Max 100 total requests across all rounds
```

### Timeout Calculation

```typescript
const timeout = 10000 + (totalRequests * 2000); // Base 10s + 2s per request
```

Transaction strategies apply timeout to entire batch. Non-transaction strategies may exceed timeout if individual requests are slow.

---

## Implementation Patterns

### Pattern: Type-Safe Constants

Batch module uses `keyof typeof` pattern for single source of truth.

**File:** `apps/api/src/modules/batch/constants.ts`

```typescript
// Define strategies object
export const BatchExecutionStrategies = {
  transactionAll,
  transactionPerRound,
  allowFailures,
  failOnRound,
} as const;

// Derive type from object keys
export type BatchExecutionStrategy = keyof typeof BatchExecutionStrategies;

// Create Zod enum helper
export const batchExecutionStrategyEnum = Object.keys(BatchExecutionStrategies) as [
  keyof typeof BatchExecutionStrategies,
  ...Array<keyof typeof BatchExecutionStrategies>
];

// Use in route schema
z.enum(batchExecutionStrategyEnum)
```

**Benefits:**
- Add new strategy in one place
- Types automatically update
- Schema validation stays in sync
- Impossible to desync manually

### Pattern: Strategy Implementation

Each strategy implements `StrategyExecutor` interface:

```typescript
type StrategyExecutor = (
  app: Hono<AppEnv>,
  rounds: BatchRequest[][],
  sharedHeaders: Record<string, string>,
  baseRequest: Request,
  baseContext: Context<AppEnv>,
  timeout: number,
) => Promise<BatchResult>;
```

**Common structure:**
1. Initialize batch registry with `registerBatch(batchId, db, baseContext)`
2. Execute rounds (transaction or non-transaction)
3. Track success/failure counts
4. Calculate status based on strategy semantics
5. Cleanup with `unregisterBatch(batchId)`

### Pattern: Batch Context

Internal requests inherit authentication from parent request:

```typescript
// Parent request authenticated → all batch requests use same auth
const batchId = crypto.randomUUID();
registerBatch(batchId, db, parentContext);

// Internal requests detect batch via X-Batch-Id header
const internalRequest = new Request(url, {
  headers: { 'X-Batch-Id': batchId }
});

// Middleware loads batch context and skips re-authentication
```

**Key files:**
- `apps/api/src/modules/batch/services/batchRegistry.ts` - In-memory storage
- `apps/api/src/middleware/prepareRequest.ts` - Context injection
- `apps/api/src/middleware/auth/*.ts` - Auth skipping logic

---

## Testing

Comprehensive test suite covering all strategies and edge cases.

**File:** `apps/api/src/modules/batch/tests/batchExecute.test.ts`

**Coverage:**
- Basic functionality (5 tests)
- Strategy behavior (8 tests)
- Security validations (7 tests)
- **Total:** 21 tests, 82 expect() calls

**Run tests:**
```bash
cd apps/api
bun test src/modules/batch/tests/batchExecute.test.ts
```

---

## Known Limitations

1. **In-memory batch registry** - Won't scale across multiple server instances. For distributed systems, migrate to Redis.

2. **No batch-level rollback for non-transaction strategies** - `allowFailures` and `failOnRound` commit requests as they succeed.

3. **Request order matters** - Interpolation requires sequential round execution. Can't parallelize rounds.

4. **Timeout applies globally** - Transaction strategies timeout entire batch, not individual requests.

---

## See Also

- [API_ROUTES.md](./API_ROUTES.md) - Route conventions
- [TESTING.md](./TESTING.md) - Test patterns
- [CONTEXT.md](./CONTEXT.md) - Request context system
