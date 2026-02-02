# Redis

## Contents

- [Connection Management](#connection-management)
- [Namespaces](#namespaces)
- [Built-In Uses](#built-in-uses)
- [Cache Utilities](#cache-utilities)
- [Testing](#testing)

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
| `job` | `job:*` | Job coordination (supersede flags, singleton locks) |
| `ws` | `ws:*` | WebSocket pub/sub channels |
| `otp` | `otp:*` | One-time passwords / verification codes |
| `session` | `session:*` | BetterAuth sessions (via secondaryStorage) |
| `limit` | `limit:*` | Rate limiting counters |

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

// Superseding job signal (tells old job to abort)
`${redisNamespace.job}:superseded:${jobId}`
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

Cache keys defined in `CACHE_REFERENCE` are auto-cleared on mutations. See [HOOKS.md - Cache Invalidation](./HOOKS.md#cache-invalidation).

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
