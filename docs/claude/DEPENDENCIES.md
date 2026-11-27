# Dependencies

<!-- toc:start -->

## Contents

- [Core](#core)
- [Database](#database)
- [Cache & Queue](#cache--queue)
- [Auth & Permissions](#auth--permissions)
- [Validation](#validation)
- [Logging & Telemetry](#logging--telemetry)
  - [Optional Integration Setup](#optional-integration-setup)
- [Email](#email)
- [Utilities](#utilities)
- [Frontend](#frontend)
- [Planned](#planned)
- [Dev Dependencies](#dev-dependencies)

<!-- toc:end -->


---

## Core

| Package | Purpose | Notes |
|---------|---------|-------|
| `bun` | Runtime | Fast JS/TS runtime, built-in test runner |
| `hono` | Web framework | Fast, lightweight, middleware-based |
| `@hono/zod-openapi` | OpenAPI | Auto-generates OpenAPI spec from Zod schemas |

---

## Database

| Package | Purpose | Notes |
|---------|---------|-------|
| `prisma` | ORM | Schema-first, type-safe queries |
| `@prisma/client` | Query client | Generated from schema |
| `@prisma/adapter-pg` | Postgres driver | Native pg adapter for Prisma |
| `pg` | Postgres client | Connection pooling |
| `prisma-zod-generator` | Zod schemas | Generates Zod from Prisma models |
| `@inixiative/field-map` (`^0.1.1`) | The schema map: types, Prisma reader, own-property readers, JSON Schema reader, compile-time paths | `field-map generate` writes `prismaMap.gen.ts` (packages/db, in `db:generate`); every package reads the map through its readers, never a local copy of the field shape |

---

## Cache & Queue

| Package | Purpose | Notes |
|---------|---------|-------|
| `ioredis` | Redis client | Connection management, pub/sub |
| `ioredis-mock` | Redis mock | In-memory mock for tests |
| `bullmq` | Job queue | Background jobs, cron scheduling |
| `@bull-board/api` | Queue UI | Web dashboard for BullMQ |
| `@bull-board/hono` | Queue UI adapter | Hono integration |

---

## Auth & Permissions

| Package | Purpose | Notes |
|---------|---------|-------|
| `better-auth` | Authentication | Sign-in handshake, social providers, user-JWT signing keys (`jwt()` plugin) |
| `@template/permissions` (`workspace:*`) | RBAC/ReBAC package | In-repo private package (packages/permissions); consumed by apps/api and packages/ui |
| `permix` (`^3.6.0`) | Permissions | RBAC with runtime checks; declared inside `@template/permissions` |

---

## Validation

| Package | Purpose | Notes |
|---------|---------|-------|
| `zod` | Schema validation | Runtime type checking, OpenAPI integration |
| `@inixiative/json-rules` (`^3.0.0`) | Rules engine | Declarative validation in hooks |

---

## Logging & Telemetry

| Package | Purpose | Required |
|---------|---------|----------|
| `consola` | Logger | Yes |
| `@sentry/bun` | Error tracking | Optional (`SENTRY_ENABLED`) |
| `@opentelemetry/*` | Tracing/metrics | Optional (`OTEL_ENABLED`) |
| `@prisma/instrumentation` | DB tracing | With OpenTelemetry |

### Optional Integration Setup

```env
# Sentry (error tracking)
SENTRY_ENABLED=true
SENTRY_DSN=https://xxx@sentry.io/xxx

# OpenTelemetry (tracing/metrics)
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=https://...
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer xxx
```

---

## Email

| Package | Purpose | Notes |
|---------|---------|-------|
| `resend` | Email provider | Transactional email API |
| `mjml` | Email templates | Responsive email markup, renders to HTML |
| `date-fns`, `date-fns-tz` | Dates in templates | `{{datetime}}` prints a date-fns `format` pattern in a time zone (`formatInTimeZone`) |

Part of `@template/email` package. See [COMMUNICATIONS.md](COMMUNICATIONS.md) for usage.

---

## Utilities

| Package | Purpose | Notes |
|---------|---------|-------|
| `lodash-es` | Utilities | Tree-shakeable lodash |
| `uuidv7` | ID generation | Time-sortable UUIDs |
| `pluralize` | String utils | Model name pluralization |

---

## Frontend

| Package | Purpose | Location |
|---------|---------|----------|
| `react` | UI framework | `apps/web`, `packages/shared` |
| `@tanstack/react-query` | Data fetching | Peer dep in shared |
| `tailwind-merge` | CSS utils | `packages/shared` |
| `clsx` | Class names | `packages/shared` |

---

## Planned

| Package | Purpose | When to Add |
|---------|---------|-------------|
| `stripe` | Payments | Billing, subscriptions |
| `@aws-sdk/client-s3` | File storage | User uploads, assets |
| `sharp` | Image processing | Thumbnails, optimization |

---

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `@types/bun` | Bun types |
| `@faker-js/faker` | Test data generation |
| `biome` | Linting/formatting |
