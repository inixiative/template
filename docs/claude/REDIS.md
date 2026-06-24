# Redis

<!-- toc:start -->

## Contents

- [Connection Management](#connection-management)
  - [Connection Strategy](#connection-strategy)
  - [Why Separate Connections?](#why-separate-connections)
- [Namespaces](#namespaces)
  - [Current Namespaces](#current-namespaces)
- [Built-In Uses](#built-in-uses)
  - [Cache (`cache:*`)](#cache-cache)
  - [Sessions (`session:*`)](#sessions-session)
  - [Rate Limiting (`limit:*`)](#rate-limiting-limit)
  - [Job Coordination (`job:*`)](#job-coordination-job)
  - [WebSocket Pub/Sub (`ws:*`)](#websocket-pubsub-ws)
  - [BullMQ (`bull:*`)](#bullmq-bull)
- [Cache Utilities](#cache-utilities)
  - [cacheKey() Builder](#cachekey-builder)
  - [cache() Get-or-Set](#cache-get-or-set)
  - [clearKey()](#clearkey)
  - [Automatic Invalidation](#automatic-invalidation)
- [Testing](#testing)
  - [In-Memory Mock](#in-memory-mock)
  - [Test Isolation](#test-isolation)
  - [Queue Mock](#queue-mock)
- [Error Handling](#error-handling)
  - [Connection Errors](#connection-errors)
  - [Cache Fallback](#cache-fallback)
  - [Key Validation](#key-validation)

<!-- toc:end -->


---

## Connection Management

Located in `packages/db/src/redis/`.

### Connection Strategy

| Connection | Purpose | Notes |
|------------|---------|-------|
| Main (`getRedisClient`) | All regular operations | Cache, rate limits, sessions, OTP |
| Subscriber (`getRedisSub`) | Pub/sub subscriptions | `SUBSCRIBE` is blocking, needs own connection |
| Publisher (`getRedisPub`) | Pub/sub publishing | Shares main client (publish doesn't block) |
| BullMQ | Job queues | Manages own connections via `createRedisConnection` |

```typescript
import { getRedisClient, getRedisPub, getRedisSub, createRedisConnection } from '@template/db';

// Regular operations
const redis = getRedisClient();
await redis.get('key');

// WebSocket pub/sub
const pub = getRedisPub();
const sub = getRedisSub();

// BullMQ creates its own
const bullConnection = createRedisConnection('Redis:BullMQ:Worker');
```

### Why Separate Connections?

- **Subscriber isolation**: `SUBSCRIBE` puts connection in pub/sub mode - can't run other commands
- **BullMQ requirement**: Queue and Worker need separate connections for reliability
- **Single main client**: All non-blocking operations share one connection (efficient)

---

## Namespaces

All Redis keys must use namespaces from `packages/db/src/redis/namespaces.ts`:

```typescript
import { redisNamespace } from '@template/db';

// Good
const key = `${redisNamespace.cache}:User:${id}`;
const lockKey = `${redisNamespace.job}:lock:${jobId}`;

// Bad - hardcoded prefixes
const key = `cache:User:${id}`;  // Don't do this
```

### Current Namespaces

| Namespace | Prefix | Purpose |
|-----------|--------|---------|
| `bull` | `bull:*` | BullMQ job queues (managed by BullMQ) |
| `cache` | `cache:*` | Application cache (user lookups, tokens, etc.) |
| `job` | `job:*` | Job coordination (supersede lanes, singleton locks) |
| `ws` | `ws:*` | WebSocket pub/sub channels |
| `otp` | `otp:*` | One-time passwords / verification codes |
| `session` | `session:*` | BetterAuth sessions (via secondaryStorage) |
| `limit` | `limit:*` | Rate limiting counters |
| `lock` | `lock:*` | Distributed locks via `createLock` |

---

## Built-In Uses

### Cache (`cache:*`)

Application data caching with TTL. See [Cache Utilities](#cache-utilities).

```typescript
// Token lookup by hash (use object for non-ID fields)
cacheKey('token', { keyHash })         // → cache:token:keyHash:abc123

// User by email
cacheKey('user', { email })            // → cache:user:email:foo@example.com
```

### Sessions (`session:*`)

BetterAuth session storage via `secondaryStorage` config:

```typescript
// In lib/auth.ts
secondaryStorage: {
  get: (key) => redis.get(`${redisNamespace.session}:${key}`),
  set: (key, value, ttl) => redis.setex(`${redisNamespace.session}:${key}`, ttl, JSON.stringify(value)),
  delete: (key) => redis.del(`${redisNamespace.session}:${key}`),
}
```

### Rate Limiting (`limit:*`)

Request rate limiting by token or IP:

```typescript
// API rate limit (per second)
`${redisNamespace.limit}:api:token:${tokenId}`
`${redisNamespace.limit}:api:ip:${clientIp}`

// Custom rate limits
`${redisNamespace.limit}:auth:${ip}`      // Auth endpoints
`${redisNamespace.limit}:email:${ip}`     // Email sending
```

### Job Coordination (`job:*`)

Singleton locks and superseding job signals:

```typescript
// Singleton job lock (prevents concurrent runs)
`${redisNamespace.job}:lock:${cronJobId}`

// Superseding lane (holds the current holder's jobId; a different holder means the prior job was usurped)
`${redisNamespace.job}:lane:${handlerName}:${dedupeKey}`
```

### WebSocket Pub/Sub (`ws:*`)

Cross-server WebSocket broadcasting:

```typescript
// Pub/sub channel for all WS messages
const WS_CHANNEL = 'ws:broadcast';

// Messages include type: 'user' | 'channel' | 'broadcast'
await pub.publish(WS_CHANNEL, JSON.stringify({ type: 'channel', target: 'org:123', event }));
```

### BullMQ (`bull:*`)

Managed by BullMQ internally. Queue name is `jobs`:

```typescript
// BullMQ keys look like:
// bull:jobs:waiting
// bull:jobs:active
// bull:jobs:completed
// bull:jobs:failed
```

---

## Cache Utilities

Located in `packages/db/src/redis/cache.ts`.

### cacheKey() Builder

Standard key format: `cache:{accessor}:{field}:{value}[:{tags}][:{*}]`

```typescript
import { cacheKey } from '@template/db';

// String identifier = lookup by id
cacheKey('user', 'abc-123')                              // cache:user:id:abc-123

// Object identifier = lookup by specified field(s)
cacheKey('user', { email: 'foo@example.com' })           // cache:user:email:foo@example.com

// Composite key (sorted alphabetically)
cacheKey('organizationUser', { userId: 'u1', organizationId: 'o1' })
  // → cache:organizationUser:organizationId:o1:userId:u1

// With tags
cacheKey('user', 'abc-123', ['WithOrgs'])                // cache:user:id:abc-123:WithOrgs

// With wildcard
cacheKey('session', { userId: 'abc-123' }, [], true)     // cache:session:userId:abc-123:*
```

### cache() Get-or-Set

```typescript
import { cache } from '@template/db';

const user = await cache(
  cacheKey('User', id),
  async () => db.user.findUnique({ where: { id } }),
  60 * 60  // Optional TTL (default: 24 hours)
);
```

Behavior:
- Returns cached value if exists (including `null`/`undefined`)
- Computes via fn() on cache miss
- **Negative caching**: `null`/`undefined` cached with 1 min TTL (prevents thundering herd, allows quick discovery of new records)
- Real values cached with provided TTL (default 24 hours)

### clearKey()

Clear cache entries - supports exact keys and wildcard patterns:

```typescript
import { clearKey } from '@template/db';

// Exact key
await clearKey('cache:User:id:123');

// Wildcard pattern (uses SCAN, non-blocking)
await clearKey('cache:User:*');
await clearKey('cache:Session:userId:abc:*');
```

### Automatic Invalidation

Cache keys defined in the cache reference map are auto-cleared on mutations via an after-commit db hook. See [HOOKS.md - Cache Invalidation](./HOOKS.md#cache-invalidation).

#### Invalidation conventions

Correctness here is enforced by **discipline and tests, not by types** — nothing compiler-checks that a mutation clears the right keys. These rules are what keep it correct:

- **Reverse-reference map.** The map answers "given this changed record, which keys is it reachable by?" — so a write becomes a key *lookup*, not a search. Per cached model, return every key the record is read under (id, value lookups, and cross-entity tag keys).
- **One canonical key, or it drifts.** Always build keys with `cacheKey`, never hand-format. The domain (model/accessor) is normalized to the accessor, so a write keyed `'User'` and a clear keyed `'user'` resolve to the *same* key. Hand-built or differently-cased keys silently skip invalidation (Redis keys are case-sensitive).
- **One tool, every surface — kept sound by Previous ∪ Result.** The data is read under several surfaces (id, value lookups like email/slug, relationship/tag keys) — don't restrict to id-only or relation-only; build keys with the one `cacheKey` tool across all of them. Value keys move with the record, so the hook clears keys derived from **both** the previous and result rows — a value change drops its *old* key too. The tool matches the problem's surfaces; P∪R is what makes the value surfaces correct.
- **Invalidate on structure, not payload.** A record's payload change and its *linkage* change are different events. A payload update may *read* a relationship-reach cache (e.g. to fire a webhook); only a link change (a `CustomerRef`/subscription mutation) should *bust* it. Express this with different key sets per entry — e.g. `User` clears `user:id` but not `user:…:customerRefs`; only `CustomerRef` clears the linkage.
- **Know what *not* to cache.** A read whose correct invalidation needs a relationship/graph walk (webhook subscriptions reached via `customerRef`) is fetched fresh, or cached only on the slow-moving *linkage* side. Caching it by affected-model can't be invalidated correctly — a missed clear is a stale read served silently.
- **Tests are the enforcement.** Because none of the above is compiler-checked, every cached entity needs a read-after-write test (cache under the call-site key → mutate → assert cleared). That test catches drift; nothing else does.

---

## Testing

### In-Memory Mock

In test environment, all Redis operations use a shared in-memory mock:

```typescript
// In packages/db/src/redis/client.ts
if (isTest) {
  if (!__mock) __mock = new RedisMock() as unknown as Redis;
  return __mock;
}
```

All connections (`getRedisClient`, `getRedisSub`, `createRedisConnection`) return the same mock instance.

### Test Isolation

```typescript
import { flushRedis } from '@template/db';

beforeEach(async () => {
  await flushRedis();  // Clear all keys between tests
});
```

`flushRedis()` throws if called outside test environment.

### Queue Mock

BullMQ queue is mocked in tests to avoid actual job processing:

```typescript
// tests/mocks/queue.ts
mock.module('#/jobs/queue', () => ({
  queue: {
    add: async (name: string) => ({ id: `mock-${++jobCounter}`, name }),
    getJobs: async () => [],
    redis: getRedisClient(),  // Uses same mock
  },
}));
```

---

## Error Handling

### Connection Errors

```typescript
redis.on('error', (err) => log.error(`[${name}] Error:`, err));
redis.on('connect', () => log.info(`[${name}] Connected`));
```

### Cache Fallback

Cache operations gracefully degrade when Redis is unavailable:

- **Read errors**: Fall through to compute value (Redis down = cache miss)
- **Write errors**: Fire-and-forget with error logging (don't block response)
- **Compute errors**: Propagate normally (not swallowed)

### Key Validation

Cache utilities validate keys to catch bugs early:

```typescript
function validateKey(key: string): void {
  if (key.includes('undefined')) {
    throw new Error(`Cache key contains 'undefined': ${key}`);
  }
}
```
