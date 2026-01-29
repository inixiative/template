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
import { log } from '@template/shared/logger';

log.info('User created', { userId: user.id });
log.warn('Rate limit approaching');
log.error('Failed to process webhook', error);
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

### Entry Points Set Base Scope

```typescript
// prepareRequest.ts
await logScope('api', () => logScope(requestId, () => ...));

// worker.ts
await logScope('worker', () => logScope(jobId, () => ...));
```

### Output

```
[2024-01-29T14:32:45.123Z][api][abc12345] handling request
[2024-01-29T14:32:45.456Z][api][abc12345] User created { userId: 'usr_xyz' }
[2024-01-29T14:33:01.789Z][worker][send:def] processing webhook
[2024-01-29T14:33:07.012Z][worker][send:def] slow mutation: Token.update took 6.23s
```

### How It Works

```typescript
import { log, logScope } from '@template/shared/logger';

// Scopes stack - inner code sees all outer scopes
await logScope('api', async () => {
  log.info('outer');  // [api] outer

  await logScope('req123', async () => {
    log.info('inner');  // [api][req123] inner
  });
});
```

### Scope Exits Automatically

`logScope` uses `AsyncLocalStorage.run()` - scope clears when the function returns.

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
