# Logging and monitoring

The application emits three kinds of evidence:

| Signal | Answers | Example |
| --- | --- | --- |
| Structured logs | What happened, with which identifiers? | Reminder delivery failed; job ID and attempt |
| Traces | Where did this operation spend time or fail? | Browser → API → Prisma/Redis → worker |
| Metrics | How often, how slow, how much? | Error rate, request latency, queue depth, memory |

Pino and Consola are logger libraries, not hosting services. The existing shared logger is the adapter boundary: Pino writes JSON in hosted environments; Consola displays readable output in local/test. OpenTelemetry carries logs, traces and metrics to an OTLP-compatible destination. The SDK uses fetch-based OTLP/HTTP JSON exporters, adapted from Zealot's Bun approach; it does not rely on Node monkey-patching under Bun.

## Structured logging

```typescript
import { log, withLogContext } from '@template/shared/logger';

await withLogContext({ botId, operation: 'sendReminder' }, async () => {
  log.info({ event: 'reminder.sent', reminderId }, 'Reminder sent');
});
```

Both `log.info(fields, message)` and `log.info(message, fields)` preserve object fields. Child bindings survive: `log.child({ component: 'whatsapp', botId })`. Nested objects stay objects in Pino output; OTLP log attributes serialize nested objects as JSON for compatibility with providers that require primitive attribute values. Put frequently searched identifiers in top-level fields.

`logScope(id, fn)` adds a display scope. Passing `LogScope.worker` as the last argument appends a scope. `withLogContext(fields, fn)` adds named searchable fields across async calls. API logs acquire `requestId`; worker logs acquire `jobId`, `jobName`, and `attempt`. Active spans add `trace_id` and `span_id`, including on error logs.

`LOG_LEVEL` filters all facade outputs, including OTLP and BullBoard broadcasts. `success` and `box` map to info severity. Scoped broadcasts still receive text; failures in an observer or broadcaster do not interrupt application code. The native `pinoLogger` export supports SDKs that require Pino itself, but only calls through the `log` facade join the OTLP/broadcast pipeline.

Redaction runs before sinks: sensitive field names (passwords, credentials, tokens, cookies, email, phone, body, payload), credential-bearing URL userinfo, URL queries/fragments in messages, and common authorization strings. Error stacks are bounded; Prisma error details omit SQL/input dumps. Circular structures and bigint are supported. Oversized records lose fields rather than generating enormous export batches. This is a safeguard, not permission to log arbitrary user text. Use identifiers and event names; never log message bodies, headers, raw SQL, query arguments or whole user records.

## Setup

Run `bun run init`, choose **Monitoring**, then choose one destination, split destinations, or disable. The task stores credentials only in Infisical's `/api` path. Browser paths receive only an enable flag and sampling ratio. Each secret write records its progress; rerunning safely reapplies settings after partial failure. Settings flow through the existing environment imports. Apply them with the normal deployment flow; browser changes need a rebuild. This task does not create provider accounts, purchase plans, or deploy services.

Headless setup accepts `bun run init:agent --section=monitoring` with `MONITORING_MODE=off|otlp|split` and the environment variables below. The monitoring section is optional and is not run by the unattended full flow unless explicitly selected.

### New Relic traces/metrics + Better Stack logs

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=tribe
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net
OTEL_EXPORTER_OTLP_HEADERS=api-key=YOUR_NEW_RELIC_LICENSE_KEY
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://YOUR_INGESTING_HOST/v1/logs
OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20YOUR_BETTER_STACK_SOURCE_TOKEN
OTEL_TRACES_SAMPLER_ARG=1
OTEL_BROWSER_ENABLED=true
```

Use your New Relic region's endpoint and Better Stack source's ingesting host. Do not use a Better Stack management API token. References: [New Relic OTLP](https://docs.newrelic.com/docs/opentelemetry/best-practices/opentelemetry-otlp/), [Better Stack OpenTelemetry](https://betterstack.com/docs/logs/open-telemetry/).

A signal-specific endpoint is a **complete URL**, including `/v1/logs`, `/v1/traces`, or `/v1/metrics`. The general endpoint is a base URL. All three signals support `OTEL_EXPORTER_OTLP_{SIGNAL}_ENDPOINT` and `_HEADERS`. A different-origin endpoint requires explicit signal headers, even if empty, to prevent forwarding another provider's credentials. Signal headers replace general headers. Percent-encode header values containing commas or other separators.

API and worker names are `${OTEL_SERVICE_NAME}-api` and `-worker`; browser names are `-web`, `-admin`, and `-superadmin`. The service name setting is a **base name** (change older values such as `template-api` to `template`). Resources also carry environment, service version and process instance ID. `OTEL_SERVICE_VERSION` overrides the Railway commit SHA fallback.

Monitoring settings stored in Infisical `root` are inherited by `pr`, `staging`, and `prod`; each environment can override or disable them independently. API and worker export automatically in these hosted environments when an OTLP endpoint is configured and `OTEL_ENABLED` is unset. Missing destinations leave export inactive. Local, test, and unspecified environments require `OTEL_ENABLED=true`. This decision uses `ENVIRONMENT`, not `NODE_ENV`.

One provider works by leaving all signal overrides unset. `OTEL_ENABLED=false` disables exports; ordinary console logging continues. Enabled but invalid settings fail startup visibly. Local and test exports are allowed only when explicitly enabled.

### Browser setup

Set these build-time variables for each frontend:

```dotenv
VITE_OTEL_ENABLED=true
VITE_OTEL_SAMPLE_RATIO=1
```

`VITE_API_URL` identifies the API. Configure `WEB_URL`, `ADMIN_URL`, and `SUPERADMIN_URL` on the API; their exact HTTP(S) origins are allowed, including when configured URLs have paths or trailing slashes. Browser capture remains explicitly controlled by `VITE_OTEL_ENABLED` and server ingestion by `OTEL_BROWSER_ENABLED`, in every environment. The browser SDK batches page-load spans, API SDK request spans, unhandled errors/rejections and React errors. It attaches `traceparent` only to this API's requests; query strings and request bodies are never recorded. Collection starts asynchronously after enabling the browser SDK; very early startup failures/requests may precede it.

A bounded, origin-checked, rate-limited `/api/telemetry/browser` endpoint validates browser events and converts them to OTLP. It stamps browser service identity itself and forwards only to configured server destinations. It accepts no arbitrary URL, header, or resource attributes. Browser evidence is explicitly marked `telemetry.source=browser`: it is client-reported evidence, not a trusted audit trail. Origins reduce accidental/drive-by use, not forged server callers; apply edge rate limits if exposed publicly. Sampling, per-IP and global ingress limits cap routine volume. The existing Redis limiter fails open on Redis outages.

No provider credentials belong in `VITE_*`. Browser console logs remain local via `@template/ui/lib/frontendLogger`; automatic browser errors are sent as trace exception events. This is basic browser telemetry, not session replay, source-map management or a full RUM suite.

## Inspect locally without any provider

```sh
docker compose -f scripts/monitoring/compose.yaml up -d
OTEL_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 bun scripts/monitoring/smoke.ts
docker compose -f scripts/monitoring/compose.yaml logs collector
docker compose -f scripts/monitoring/compose.yaml down
```

The pinned Collector validates real OTLP requests and prints all three signal types. The smoke command prints a trace ID: search for it in both logs and spans. The password sample must appear as `[REDACTED]`. Clear any hosted signal overrides when testing locally. For a running local API/worker use the same settings in `apps/api/.env.local`; enable browser capture separately if desired. Nothing leaves your computer in this configuration.

## Coverage and limits

| Area | Included | Separate work |
| --- | --- | --- |
| API | Route-template spans; duration/status metrics; request correlation; health excluded | External-provider instrumentation at integration boundaries |
| Jobs | Persisted trace carrier through BullMQ/outbox; attempt span, duration, correlated failure log; queue counts | Age/SLA policies, alert rules |
| Prisma | Logical operation/model spans and duration/outcome; no SQL or args | Database host CPU, locks, slow-query analysis, connection-pool monitoring |
| Redis | Command duration/outcome; no keys/values; callback/pipeline semantics retained | Redis server memory, evictions, replication; blocking/pubsub commands excluded |
| Runtime | Process RSS, heap usage and CPU time | Host/container/disk/network metrics via infrastructure agents or Collector receivers |
| Browser | Navigation load, SDK requests, unhandled/React errors; cross-service trace IDs | Web Vitals, source maps, session replay, pre-initialization failures |
| Business | `withSpan`, `recordDuration`, structured event fields available to integrations | WhatsApp connectivity, delivery receipts, LLM latency/token/cost, storage/email/webhook outcomes |

Trace sampling uses a parent-based ratio; metrics and logs remain independent. Changing the ratio can leave logs with trace IDs whose spans were not retained. Labels on built-in metrics are bounded route/model/operation/state names; user/job IDs belong in logs and spans, never metric labels.

Export is bounded and best-effort: batches use finite queues/timeouts and drop on collector rejection/outage rather than blocking business operations. Failures produce a rate-limited console warning without credentials or collector response bodies. Graceful API/worker shutdown drains work then flushes providers. Abrupt process termination can lose buffered data. Use a nearby Collector with a persistent sending queue if loss-resistant delivery is required. Do not also scrape stdout into the same log backend without filtering, or every log will be ingested twice.

## Following an incident across two services

1. Open the failed/slow operation in New Relic and copy its trace ID.
2. Search Better Stack logs for `trace_id` with that value.
3. Follow `requestId`, `jobId`, `botId`, and the structured `event` field to understand the domain event.

Retention is separate: a trace may outlive its logs. Provider deep links and saved dashboards can be added after account/source IDs are known. The [superadmin alert proposal](./MONITORING_ALERTS.md) builds on these signals in a separate PR.

The existing Sentry error-reporter adapter remains available independently; enabling OTel does not configure or remove it.
