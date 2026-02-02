# Logging & Telemetry

## Contents

- [Logger](#logger)
- [Log Scopes](#log-scopes)
- [OpenTelemetry](#opentelemetry)
- [Sentry](#sentry)

---

## Logger

Located in `@template/shared/logger`. Uses [consola](https://github.com/unjs/consola) with automatic scope tagging.

### Usage

```typescript
import { log, LogScope } from '@template/shared/logger';

log.info('User created');
log.warn('Rate limit approaching');
log.error('Failed to process webhook');

// With manual scope (overrides automatic scopes)
log.info('Database connected', LogScope.db);
```

### Log Levels

Set via `LOG_LEVEL` env var (default: `info`):

| Level | Description |
|-------|-------------|
| `silent` | No output |
| `error` | Errors only |
| `warn` | Warnings |
| `info` | Info (default) |
| `debug` | Debug info |
| `trace` | Detailed tracing |

### Environment Behavior

| Environment | Colors | Format |
|-------------|--------|--------|
| local/test | Yes | Expanded |
| production | No | Compact |

---

## Log Scopes

Scopes tag log output with context. They stack automatically.

### LogScope Enum

```typescript
import { LogScope } from '@template/shared/logger';

LogScope.api      // 'api'
LogScope.db       // 'db'
LogScope.worker   // 'worker'
LogScope.seed     // 'seed'
LogScope.ws       // 'ws'
LogScope.test     // 'test'
LogScope.auth     // 'auth'
LogScope.cache    // 'cache'
LogScope.hook     // 'hook'
LogScope.job      // 'job'
LogScope.email    // 'email'
```

### Usage

```typescript
import { log, logScope, LogScope } from '@template/shared/logger';

// Normal logging (uses automatic scope from logScope if any)
log.info('message');

// Manual scope as last argument - OVERRIDES automatic scopes
log.info('message', LogScope.worker);
log.error('failed', LogScope.seed);
```

**Note**: Manual scope completely replaces any automatic scopes from `logScope()`. Use for logging outside wrappers or when you need a specific context.

### Automatic Scopes with logScope()

Wrap execution to automatically tag all logs within. Scopes nest automatically:

```typescript
// Simple usage
await logScope(LogScope.api, async () => {
  log.info('processing');  // [api] processing
});

// Nested scopes (chain without await inside)
await logScope(LogScope.api, () => logScope(requestId, async () => {
  log.info('handling request');  // [api][abc123] handling request
}));
```

### Entry Points

```typescript
// prepareRequest.ts - chains scopes without intermediate await
await logScope(LogScope.api, () => logScope(requestId, () => db.scope(requestId, next)));

// worker.ts
await logScope(LogScope.worker, () => logScope(scopeId, () => handler(ctx, payload)));
```

### Output

```
[2024-01-29T14:32:45.123Z][api][abc12345] handling request
[2024-01-29T14:33:01.789Z][worker][send:def] processing webhook
[2024-01-29T14:33:07.012Z][seed] Seed completed
```

### Frontend Apps

The main `log` uses `AsyncLocalStorage` (Node-only). For frontend apps, use `createFrontendLogger`:

```typescript
import { createFrontendLogger, FrontendScope } from '@template/shared/logger';

// Create once per app (e.g., in lib/logger.ts)
export const log = createFrontendLogger(FrontendScope.web);     // 'web'
export const log = createFrontendLogger(FrontendScope.admin);   // 'admin'
export const log = createFrontendLogger(FrontendScope.superadmin); // 'super'

// Usage
log.info('Page loaded');   // [web] Page loaded
log.error('API failed');   // [web] API failed
```

---

## OpenTelemetry

Located in `apps/api/src/config/otel.ts`. OTLP-compatible tracing and metrics.

### Environment Variables

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://in-otel.logs.betterstack.com
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <token>
OTEL_SERVICE_NAME=inixiative-api  # defaults to 'inixiative-api'
```

### Auto-Instrumentation

When endpoint is configured, automatically traces:
- HTTP requests (excluding `/health`)
- Prisma queries

Skipped in local/test environments.

### Initialization

Called at startup in `index.ts`:

```typescript
import { initializeOpenTelemetry } from '#/config/otel';
await initializeOpenTelemetry();
```

Uses dynamic imports to avoid loading OTel packages in local/test.

---

## Sentry

Error tracking via `@sentry/bun`. Configured in error handler middleware.

### Environment Variables

```env
SENTRY_ENABLED=true
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Automatic Capture

Errors captured in `errorHandlerMiddleware`:
- HTTP 5xx errors
- Unhandled exceptions

### NOT Captured

- Test environment errors
- HTTP 4xx errors (client errors)
- Zod validation errors (422)
- Prisma constraint violations (409, 404)

### Manual Capture

```typescript
import * as Sentry from '@sentry/bun';

Sentry.captureException(error);
Sentry.captureMessage('Something happened', 'warning');
```
