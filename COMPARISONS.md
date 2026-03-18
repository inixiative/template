# How This Template Compares

> Every system in this template exists because nothing off-the-shelf solved the problem completely. This document compares each system against the alternatives — managed services, open-source libraries, and typical homegrown approaches at companies of different sizes.
>
> We're honest about where this template is ahead, where it's on par, and where it's a foundation rather than a finished product.

---

## The Cross-Cutting Advantage

Before comparing individual systems, there's one architectural property that no combination of managed services can replicate:

**Everything lives in the same database, within the same transaction boundary, using the same rules engine.**

- Permissions, jobs, cron, webhooks, email templates — all PostgreSQL rows.
- `@inixiative/json-rules` compiles to Prisma queries AND raw SQL from a single definition.
- Side effects (webhooks, jobs, cache invalidation) fire only after transactions commit via `db.onCommit()`.
- You can query "which users have permission X" → `toPrisma()` → enqueue a job for each → all inside one atomic transaction.

The moment permissions live in Permify Cloud, jobs live in Redis, and webhooks live in Svix, you've lost transactional consistency across all of them. You can't ask "find users with this permission and notify them" in a single atomic operation. This template can.

---

## 1. Authentication & Sessions

### What the template provides
BetterAuth with email/password + OAuth, per-organization custom OAuth/SAML providers with AES-256-GCM encrypted client secrets, bearer tokens with SHA-256 hashing and 10-minute Redis cache, URL token fallback for WebSocket/email contexts, hierarchical token scopes (User → Organization → Space), personal access tokens with expiry and usage tracking, superadmin spoofing with `X-Spoofed-By` audit headers, per-token configurable rate limits.

### Comparison

| Feature | Template | Clerk | Auth0 | WorkOS | BetterAuth (raw) | Homegrown |
|---------|----------|-------|-------|--------|-------------------|-----------|
| Email/password + OAuth | Yes | Yes | Yes | Yes | Yes | Usually partial — missing email verification or OAuth callback edge cases |
| Per-org OAuth/SAML config | Yes (self-managed, AES-256-GCM encrypted) | Enterprise add-on | Yes (vendor-managed) | Yes (vendor-managed) | No | Almost never — most startups hard-code a single OAuth provider |
| Bearer tokens (SHA-256 hashed, Redis-cached) | Yes | No | No | No | Basic plugin | Usually plaintext in DB, no caching |
| URL token fallback | Yes | No | No | No | No | No |
| Hierarchical token scopes (User/Org/Space) | Yes | No | No | No | No | No — most startups have flat user-level tokens |
| PATs with usage tracking | Yes | Limited | No | No | No | Rare — usually no `lastUsedAt` tracking |
| Superadmin spoofing with audit headers | Yes | Actor JWT | Deprecated | Yes (dashboard only) | No | Direct DB access with no audit trail |
| Per-token rate limiting | Yes | No | No | No | No | No — global rate limits at best |
| Self-hosted, open source | Yes | No | No | No | Yes | Yes |

### The gap no one fills
No managed service or library provides hierarchical token scopes, SHA-256 hashed bearer tokens with Redis cache, URL token fallback, AND per-token rate limiting together. Each solves 60-70% of the auth surface. The template fills the remaining 30-40% with custom code on top of BetterAuth.

### Honest assessment
The template's auth is production-grade for the features it implements. Per-org SAML is functional but not self-serve (no customer-facing admin portal like WorkOS provides). MFA is not yet implemented.

---

## 2. Authorization & Permissions

### What the template provides
Permify-powered unified RBAC + ABAC + ReBAC with Google Zanzibar-style relationship graphs, json-rules integration for declarative policy evaluation without code deployment, hierarchical inheritance (platform → organization → space), per-request Permix client isolation, 10-minute Redis cache, permission middleware with automatic route enforcement, attribute entitlements via JSON, ReBAC schema auto-generated from Prisma schema via `@inixiative/prisma-map`.

### Comparison

| Feature | Template | Permify (raw) | SpiceDB | OpenFGA | Oso Cloud | Cerbos | CASL | Homegrown |
|---------|----------|---------------|---------|---------|-----------|--------|------|-----------|
| RBAC + ABAC + ReBAC unified | Yes | Yes | Yes | Yes | Yes | RBAC + ABAC | RBAC + ABAC | Flat RBAC with `role` column — no attribute or relationship checks |
| Zanzibar-style graph | Yes (via Permify) | Yes | Gold standard | Yes | Own model | No | No | No |
| JSON-based declarative rules | Yes (json-rules) | No (DSL) | No (DSL) | JSON schema only | No (Polar) | YAML | Serializable | No |
| Runtime policy changes without deploy | Yes | No | No | No | No | No | Partial | No |
| Three-tier hierarchy (platform/org/space) | Yes | Modeled via graph | Modeled via graph | Modeled via graph | Via Polar rules | Via derived roles | Manual | Manual |
| Per-request client isolation | Yes (Permix) | Manual | Manual | Manual | Manual | Stateless | Manual | Rare |
| Redis cache | Yes (10 min) | Internal | ZedTokens | 50-75% hit ratio | Local eval option | Stateless (N/A) | In-memory | Custom |
| Auto-route enforcement middleware | Yes | No | No | No | No | Via sidecar | No | Usually `if (user.role !== 'admin')` scattered through controllers |
| Schema from Prisma metadata | Yes (prisma-map) | No | No | No | No | No | No | No |

### The gap no one fills
The Permify + json-rules combination is unique. No dedicated authorization service offers runtime JSON-based policy changes without code deployment. Most use their own DSL (Permify's schema language, SpiceDB's DSL, Oso's Polar). The template's approach lets you change authorization rules by updating JSON in the database — no redeploy needed.

More importantly: every other permission system requires you to **sync your data into their model**. User created? Push a relationship tuple to SpiceDB. Role changed? Sync it. Tenant switched? Update the graph. You now have two sources of truth and an eventual consistency problem between them.

This template's rules evaluate against data that already exists in your database. No sync layer, no drift, no state where permissions say yes but the record doesn't exist. And because json-rules compiles to Prisma via `toPrisma()`, you can invert the question entirely: instead of "does user X have permission Y?", you can ask **"give me every user who has permission Y on resource Z"** — as a composable Prisma query, paginated, joined with anything, inside a single transaction. No other permission system can do this. SpiceDB, OpenFGA, and Permify can answer point lookups; they cannot generate the query set of entitled actors in a form you can compose with the rest of your data layer.

Practical examples: notify every user entitled to see a space when it changes, bulk-migrate every actor with a given role, find all admins across orgs with a specific entitlement. With SpiceDB you'd fetch all subjects, then query your DB separately, then reconcile — two round trips, no transaction, pagination is a nightmare. Here it's one query.

### Honest assessment
The permission system is comprehensive. The Redis cache is event-driven via the db hook — a permission change triggers cache invalidation immediately, making the TTL a safety net rather than the primary expiry mechanism. The json-rules approach trades the power of a dedicated authorization DSL for compactness and composability with the rest of the stack. For most SaaS products, that's the right trade.

---

## 3. Database & ORM

### What the template provides
Prisma 7 + PostgreSQL 18 with: automatic transaction merging via AsyncLocalStorage + Proxy, transaction-aware lifecycle hooks (beforeCreate, afterUpdate, afterDelete) that execute inside the transaction and roll back with it, post-commit callbacks (`db.onCommit()`), post-transaction job queue, branded ID types preventing accidental mixing at compile time, split schema (one file per model, 18 models), test factories with Faker and auto-inferred relationships from Prisma metadata, UUID v7 for time-sortable IDs, hydration system for recursive relationship loading with N+1 prevention via PendingMap deduplication, pass-the-delegate pattern for type-safe queries without generics, auto-generated Zod schemas, false polymorphism with explicit FKs and validation, blocked `createMany`/`updateMany` forcing `AndReturn` variants for hook support, request-scoped query tagging, constraint management (CHECK, GiST, partial unique indexes).

### Comparison

| Feature | Template | Prisma 7 (native) | Drizzle | TypeORM | Sequelize | MikroORM |
|---------|----------|--------------------|---------|---------|-----------|----------|
| Transaction-aware hooks (execute inside tx, roll back with it) | **Yes** | No | No hooks | Hooks fire before commit | Hooks fire before commit | Most startups have no hooks — side effects fire from controllers regardless of tx state |
| Post-commit callbacks | **Yes** (`db.onCommit()`) | No | No | Community pkg | **Native** (`afterCommit`) | Almost never — webhooks/emails fire immediately, causing phantom deliveries on rollback |
| Auto transaction merging (ALS + Proxy) | **Yes** | No (open request) | Community lib | Community lib | ALS propagation (no merge) | Transactions passed manually or not used at all |
| Branded ID types | **Yes** (18 types) | No (plain string) | No | No | No | Plain strings — `userId` and `orgId` are interchangeable at compile time |
| Test factories with relationship inference | **Yes** | No | No | No | No | Manual setup per test — 20+ lines of boilerplate to create a user with org membership |
| Hydration with N+1 prevention | **Yes** (PendingMap) | `include` (no dedup) | No | Eager loading | Eager loading | `populate` with N+1 problems that surface at scale |
| Split schema (file per model) | **Yes** | **Native** (v6.7+) | Schema-as-code | Entities | Models | Entities |
| UUID v7 (DB-generated) | **Yes** (`uuidv7()`) | Manual | Manual | Manual | Manual | Manual |
| False polymorphism with CHECK constraints + FK enforcement | **Yes** | Manual SQL | Manual SQL | Manual SQL | Manual SQL | Manual SQL |
| Blocked unsafe operations | **Yes** (forces `AndReturn`) | No | N/A | No | No | No |

### False polymorphism

Prisma has no native polymorphism support. Rails does (`belongs_to :commentable, polymorphic: true`), but Rails-style polymorphism uses `(modelType, modelId)` composite columns — no FK constraint, meaning orphaned references are silent and common, and the query planner gets no type information.

The template uses explicit FK columns per related type instead. This gives you: real FK constraints enforced at the DB level, typed indexes that are ~2x faster than composite `(type, id)` indexes because the planner knows exactly what it's joining, and no runtime type discrimination in application code. Prisma happens to handle these explicit FK queries well, so you get the schema clarity without losing query ergonomics.

It's not a workaround for a missing Prisma feature — it's a pattern that's strictly better than what Rails offers for the common case, filling a gap that Prisma doesn't address at all.

### The gap no one fills
**No existing ORM provides transaction-aware hooks that execute inside the transaction, roll back on failure, AND defer side effects to post-commit.** This is the exact problem that causes webhooks to fire on rolled-back financial transactions. Every ORM either fires "after" hooks before commit (risking phantom side effects) or has no hook system at all. Only Sequelize has native `afterCommit`, but it doesn't have transaction-aware entity hooks.

### Redis cache layer

The template's Redis caching deserves separate mention: composite cache keys with alphabetical sorting for consistency, SCAN-based pattern clearing (non-blocking, unlike `KEYS`), thundering herd prevention (null values cached with 60s TTL to prevent repeated expensive misses), fire-and-forget cache writes (Redis outages don't crash the application), 7 namespaces (`cache:*`, `session:*`, `job:*`, `ws:*`, `otp:*`, `limit:*`, `flag:*`), and a `cacheReference` registry that auto-generates invalidation keys per model.

Most startups use Redis as a flat key-value store with `KEYS *` for clearing and no null-value caching. The template's cache layer is closer to what you'd find at a mid-to-large company that's already been burned by thundering herds and blocking `KEYS` calls in production.

### Mutation lifecycle hooks

Five hook types execute inside transactions in a defined order: rules validation (json-rules) → immutable field stripping → DB write → cache invalidation → webhook delivery. The cache and webhook hooks use `db.onCommit()` to defer side effects. The immutable fields hook auto-infers immutability from foreign keys and supports 3+ levels of nested stripping. The webhook hook detects no-op updates (only tracking fields changed) and skips delivery.

This is the system that prevents webhooks from firing on rolled-back transactions and prevents accidental FK reassignment. No ORM provides this as a built-in.

### Honest assessment
The database layer is the deepest engineering in the template. The transaction merging, branded IDs, and hook system are production-grade. The hydration system's PendingMap deduplication prevents N+1 without DataLoader's complexity. The blocked `createMany`/`updateMany` is an opinionated choice that trades convenience for safety — not every team will agree. The mutation lifecycle hooks are genuinely novel — no ORM offers transaction-aware hooks with ordered execution, immutable field enforcement, and post-commit side effects in a single system.

---

## 4. Background Jobs & Cron

### What the template provides
BullMQ with three job constructor patterns: `makeJob()` for standard concurrent operations, `makeSingletonJob()` with Redis distributed locks (5-minute TTL, 2-minute heartbeat), `makeSupersedingJob()` where newer jobs cancel older ones by dedupeKey via polling + AbortController. Automatic retries with exponential backoff (3 attempts, 5s base). CronJob database model with schedule persistence, last/next run tracking, and manual triggering via admin endpoints. BullBoard dashboard. Graceful shutdown with 30-second timeout. Post-transaction job queue ensuring jobs fire only after successful commit.

### Comparison

| Feature | Template | BullMQ (raw) | Trigger.dev | Inngest | Graphile Worker | Temporal |
|---------|----------|-------------|-------------|---------|-----------------|----------|
| Standard jobs | Yes | Yes | Yes | Yes | Yes | Yes |
| Singleton (mutex) | Yes (Redis lock) | Dedup option | Concurrency limit | Concurrency limit | `job_key` + flags | Workflow ID |
| Superseding (cancel older) | **Yes** (dedupeKey + poll + abort) | Debounce (partial) | No | Debounce (partial) | **`job_key` replace** | Signal workflow |
| Exponential backoff | Yes | Yes | Yes | Yes (per-step) | Yes | Yes (per-activity) |
| DB-persisted cron schedules | **Yes** (CronJob model) | Redis only | Managed | Managed | PostgreSQL | Managed |
| Manual cron trigger | **Yes** (admin API) | Manual job add | SDK/API/UI | Send event | `add_job()` | Start workflow |
| Dashboard | BullBoard | BullBoard | Managed UI | Managed UI | None | Managed UI |
| Transaction-aware enqueue | **Yes** (post-tx queue) | No | No | No | **Native** (SQL in tx) | No |
| Graceful shutdown | Yes (30s timeout) | `worker.close()` | Managed | Managed | `runner.stop()` | Managed |

### The gap no one fills
Transaction-aware job enqueueing is the most underappreciated feature. Most teams discover this need via intermittent "record not found" errors in job handlers — the job fires before the transaction commits. Only Graphile Worker (natively, via SQL) and Rails 8.2 + Sidekiq solve this elegantly. The template's `db.onCommit()` pattern brings this to the BullMQ ecosystem.

### Honest assessment
The three job patterns are well-engineered. The superseding pattern (poll Redis every 500ms for abort signal) is pragmatic but not instant — there's up to 500ms latency before a superseded job notices. Graphile Worker would eliminate the need for Redis entirely but trades throughput (~10K/sec vs BullMQ's ~50K). The CronJob model with admin API for manual triggering is a genuine convenience that no managed service handles this cleanly.

---

## 5. Webhooks

### What the template provides
Event-driven webhook subscriptions scoped to org/space, RSA-SHA256 signing, async delivery via background jobs with retries, WebhookEvent tracking with status/response codes/errors, 90-day auto-cleanup, circuit breaker (disables after 5 consecutive failures), superadmin oversight routes, per-model field filtering (ignored fields), no-op update detection, false polymorphism support for related model webhook targeting.

### Comparison

| Feature | Template | Svix | Hookdeck | Convoy | Homegrown |
|---------|----------|------|----------|--------|-----------|
| Org/space scoped subscriptions | **Yes** (in-DB) | Needs mapping | No | Needs mapping | Custom |
| Signature verification | RSA-SHA256 | HMAC-SHA256 (Standard Webhooks) | Partial | HMAC-SHA256 | Custom |
| Delivery + retries | Yes (via jobs) | Yes | Yes | Yes | Custom |
| Event tracking (in your DB) | **Yes** | Dashboard only | Dashboard only | Logs | Custom |
| Circuit breaker | **Yes** (5 failures) | Yes | Yes | Yes | Rare |
| No-op update detection | **Yes** | No | No | No | Rare |
| Auto-cleanup (90 days) | **Yes** | Vendor-managed | N/A | Manual | Custom |
| Consumer self-service portal | No | **Yes** | No | Partial | Custom |
| Zero additional infrastructure | **Yes** | No (SaaS) | No (SaaS) | No (separate service) | Yes |
| Transactional consistency | **Yes** (same DB, `db.onCommit()`) | No (separate system) | No | No | Rare |

### Honest assessment
The webhook system is solid for sending. The no-op detection (compares previous vs current after stripping ignored fields) prevents noise. The circuit breaker is a good production pattern. What's missing: consumer-facing self-service portal (Svix's strength), and the signing uses RSA-SHA256 rather than the emerging Standard Webhooks spec (HMAC-SHA256 with `whsec_` prefix). The system can use any sending service as a backend — Svix could sit behind it for delivery if needed.

---

## 6. Field-Level Encryption

### What the template provides
AES-256-GCM encryption engine with registry pattern for auto-discovery, per-field version tracking for targeted rotation, type-safe generics, AAD (Additional Authenticated Data) binding ciphertext to immutable record fields, idempotent rotation with preconditions preventing double-encryption, dual-key zero-downtime rotation (current + previous), CI validation blocking version gaps or downgrades, automated rotation via background job.

### Comparison

| Feature | Template | Vault Transit | AWS/GCP KMS | prisma-field-encryption | Homegrown |
|---------|----------|---------------|-------------|-------------------------|-----------|
| AES-256-GCM | Yes | Yes (default) | Via envelope encryption | AES-256-CBC | Usually |
| Auto-discovery / registry | **Yes** | No | No | Yes (annotations) | No |
| Per-field version tracking | **Yes** | No (key-level only) | No | No | Rarely |
| AAD binding to record | **Yes** | No | No | No | Rarely |
| Dual-key zero-downtime rotation | **Yes** | Partial (rewrap) | No | Partial | Rarely |
| CI validation (version gaps) | **Yes** | No | No | No | No |
| Idempotent rotation with preconditions | **Yes** | No | No | No | No |
| No external dependency | **Yes** | No (Vault cluster) | No (cloud API) | Yes | Yes |

### The gap no one fills
Per-field version tracking combined with AAD binding doesn't exist in any off-the-shelf solution. Vault Transit versions keys globally — it can't tell you "field X on record Y is still on encryption version 2." The template can query for exactly those records and rotate them specifically. AAD binding prevents ciphertext transplant attacks (copying an encrypted value from one record to another).

### Honest assessment
The encryption engine is production-grade and more sophisticated than what most Series B companies have. The AAD binding is a genuinely advanced security feature. The CI validation preventing version gaps is defensive engineering that catches deployment mistakes before they cause data loss. Currently used for auth provider secrets — the pattern is ready for any sensitive field.

---

## 7. API Framework & Routing

### What the template provides
Hono with five route templates (read, create, update, delete, action) that auto-generate OpenAPI 3.1 specs and type-safe SDK code. File-based route auto-registration. `makeController()` factory with schema-validated responses. `makeError()` factory with guidance text and field-level validation. Pseudo-GraphQL filtering with bracket notation supporting 11 operators and 5 relation operators with 10-level nesting. Cursor and offset pagination. Resource context middleware with `?lookup=` for arbitrary field lookup. Request-scoped AppEnv. Batch API with four execution strategies and result interpolation.

### Comparison

| Feature | Template | Hono (raw) | Express | Fastify | NestJS | tRPC |
|---------|----------|------------|---------|---------|--------|------|
| Route templates with auto-OpenAPI | **Yes** (5 templates) | Manual | Manual | JSON Schema | Swagger decorators | No OpenAPI |
| File-based route auto-registration | **Yes** | Community lib | No | No | Module system | No |
| Response validation against schema | **Yes** (throws 500) | No | No | Serialization only | Interceptors | Type-safe (no runtime) |
| Structured error guidance | **Yes** (per-error-code) | No | No | No | Exception filters | No |
| Bracket notation filtering | **Yes** (11 ops, 5 relation ops, 10-level depth) | No | No | No | No | No |
| Batch API with interpolation | **Yes** (4 strategies) | No | No | No | No | No |
| Resource context middleware | **Yes** (auto-load + `?lookup=`) | No | No | No | Pipes | No |

### The bracket query system
The template's pseudo-GraphQL filtering deserves special attention:

```
?searchFields[user][name][contains]=john
?searchFields[price][gte]=100
?searchFields[tags][some][name]=urgent
```

Eleven field operators (`contains`, `equals`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, `startsWith`, `endsWith`, `not`) plus five relation operators (`some`, `every`, `none`, `is`, `isNot`) with 10-level nesting depth. Non-superadmin requests validate against declared `searchableFields`.

**This is not a GraphQL alternative — it's better than GraphQL for most SaaS use cases.** GraphQL queries are POST request bodies. They are not in the URL, cannot be shared as links, cannot be bookmarked, and are not human-readable in logs or network tools. Bracket query state lives entirely in the URL — a filtered, sorted, paginated dashboard view can be shared as a link, bookmarked, deep-linked from an email, and replayed exactly. For a SaaS product where users navigate filtered data views, that matters every day. GraphQL's advantages (colocated queries, field-level selection) apply to product UIs fetching nested data; they don't apply to admin dashboards, list views, or any context where the query is driven by user-controlled filters.

No other REST framework provides this depth of flexible URL-native querying.

### The batch API
Four execution strategies — `transactionAll`, `transactionPerRound`, `allowFailures`, `failOnRound` — with result interpolation (`<<0.0.data.id>>` references output from previous rounds). Most batch APIs (Google, Facebook, Microsoft 365) offer at most two modes (atomic vs non-atomic). The template's four strategies plus interpolation are ahead of industry standard.

The real problem this solves isn't round trips — it's the code people write to avoid them. Without a batching primitive, teams collapse multiple operations into fat multi-responsibility endpoints: `createUserAndSendEmailAndUpdateOrgAndNotify()`. These endpoints are untestable, unpredictable, and impossible to reason about. They exist purely to avoid making six calls from the client. The batch API lets you keep endpoints small and atomic — each does one thing — and compose them at the call site instead of inside the handler. That's the architectural benefit. The round trip reduction is a side effect.

### Honest assessment
The API layer is the most opinionated part of the template. The route templates eliminate boilerplate but enforce a specific CRUD-oriented pattern. Teams that need non-CRUD endpoints use `actionRoute`, which is flexible but less structured. The response validation (throwing 500 if your response doesn't match the schema) is strict — some teams may find this too aggressive for development velocity.

---

## 8. Error Handling & Structured Errors

### What the template provides
End-to-end structured error system spanning API to frontend: `makeError()` factory with automatic HTTP status mapping, `AppError` class extending Hono's `HTTPException`, 15-code `HTTP_ERROR_MAP` as single source of truth, 6 guidance categories (`fixInput`, `tryAgain`, `reauthenticate`, `requestPermission`, `refreshAndRetry`, `contactSupport`) that drive frontend UI behavior, field-level validation error aggregation from Zod, automatic Prisma error classification (P2002 → 409, P2025 → 404), request ID correlation on every error response, Sentry integration for 5xx errors, React `ErrorBoundary` component for render failures, guidance-routed toast system (errors persist until dismissed, success auto-dismisses), response validation that throws 500 if controller output doesn't match declared schema.

### Comparison

| Feature | Template | Next.js | Express | NestJS | Remix | Typical Startup |
|---------|----------|---------|---------|--------|-------|-----------------|
| Structured error body (label + guidance + fieldErrors) | **Yes** (ApiErrorBody) | No standard | No standard | Exception filters | Error boundaries | Ad-hoc JSON |
| Error factory with HTTP map | **Yes** (`makeError()` + HTTP_ERROR_MAP) | No | No | Built-in exceptions | No | `res.status(500).json({...})` |
| Guidance-driven frontend behavior | **Yes** (6 categories → toast actions) | No | No | No | No | No |
| Field-level validation errors | **Yes** (Zod → fieldErrors map) | Server Actions (partial) | express-validator | class-validator pipes | Zod (manual) | Inconsistent |
| Request ID on every error | **Yes** (UUID, header + body) | No | No | Interceptor (manual) | No | Rare |
| Prisma error classification | **Yes** (P2002→409, P2025→404) | No | No | No | No | Generic 500 |
| Response validation (schema enforcement) | **Yes** (throws 500 on mismatch) | No | No | Interceptors (opt-in) | No | No |
| React error boundary | **Yes** | **Yes** (built-in) | N/A | N/A | **Yes** (built-in) | Sometimes |
| Error monitoring (Sentry) | **Yes** (5xx auto-capture) | Manual | Manual | Manual | Manual | Sometimes |
| Toast with contextual actions | **Yes** (login button, refresh, contact support) | No | N/A | N/A | No | Rare |

### The gap no one fills
No framework provides a unified error contract that flows from API to frontend with machine-readable guidance driving UI behavior. Most teams build error handling ad-hoc: a mix of try/catch, generic toasts, and inconsistent JSON shapes. The template's `HTTP_ERROR_MAP` → `makeError()` → `ApiErrorBody` → guidance-routed toast pipeline ensures every error, from validation to server failure, produces a consistent, actionable user experience.

### Honest assessment
The error system is comprehensive for its scope. The 6 guidance categories cover the common recovery patterns well. Response validation (throwing 500 when controller output doesn't match the declared schema) is strict but catches contract violations before they reach users. Field-level validation errors only surface for Zod 422 responses — other error types carry only the message. No automatic retry with exponential backoff on the frontend (React Query handles 1 retry by default).

---

## 9. Event System

### What the template provides
In-process event registry with wildcard (`*`) and type-specific handlers, transaction-aware emission via `db.onCommit()` (handlers deferred until transaction commits), parallel handler execution, automatic WebSocket broadcast for all events (wildcard handler sends to actor's user channel and resource-specific channels), typed event payloads with actor/resource metadata, handler cleanup for testing.

### Comparison

| Feature | Template | EventEmitter (Node) | EventEmitter2 | RxJS | Inngest | Trigger.dev | Typical Startup |
|---------|----------|---------------------|---------------|------|---------|-------------|-----------------|
| Transaction-aware emission | **Yes** (`db.onCommit()`) | No | No | No | No | No | No |
| Wildcard handlers | **Yes** (`*`) | No | **Yes** | **Yes** (filter) | No | No | No |
| Auto WebSocket broadcast | **Yes** (wildcard → ws) | No | No | No | No | No | Custom |
| Typed event payloads | **Yes** (AppEventPayload) | No | No | **Yes** | **Yes** | **Yes** | Rarely |
| Handler registration/cleanup | **Yes** | **Yes** | **Yes** | **Yes** | Managed | Managed | Sometimes |
| Zero infrastructure | **Yes** (in-process) | **Yes** | **Yes** | **Yes** | No (SaaS) | No (SaaS) | Yes |
| Persistent event store | No | No | No | No | **Yes** | **Yes** | Custom |

### The gap no one fills
Transaction-aware event emission is the key differentiator. When a mutation creates a record inside a transaction, handlers (cache invalidation, WebSocket broadcast, webhook delivery) only fire after the transaction commits. No in-process event library does this — they all emit immediately regardless of transaction state. The alternative is moving to a managed event system (Inngest, Trigger.dev), which adds infrastructure and loses the single-database advantage.

### Honest assessment
The event system is intentionally simple — an in-memory Map with handler arrays. It has no persistent queue, no retry logic, and no ordering guarantees. This is the right trade-off for application events that drive cache invalidation and WebSocket broadcast. For durable event processing (payment workflows, audit logs), you'd use the job queue instead. The auto-broadcast wildcard handler is a nice integration — every `createAppEvent()` call automatically pushes to connected WebSocket clients without any per-event wiring.

---

## 10. Email System

### What the template provides
Database-driven templates with MJML rendering, reusable components via `{{component:slug}}` references, variable substitution with `{{sender.*}}`, `{{recipient.*}}`, `{{data.*}}` placeholders, conditional blocks using json-rules (`{{#if rule={...}}}...{{/if}}`), four ownership levels (default → admin → organization → space) with cascading resolution, multi-language support with locale fallback, communication categories (system vs promotional) controlling unsubscribe requirements, polymorphic ownership. Resend and console email clients implemented.

### Comparison

| Feature | Template | Resend + React Email | SendGrid | Postmark | Homegrown |
|---------|----------|---------------------|----------|----------|-----------|
| Database-driven templates | **Yes** | No (code-first) | Dashboard-stored | Dashboard-stored | Custom |
| Component composition | **Yes** (`{{component:slug}}`) | React components (code) | No | No | Rarely |
| 4-level ownership cascade | **Yes** (default/admin/org/space) | No | No | No | No |
| Multi-language + fallback | **Yes** | Community pattern | No | No | Custom |
| Conditional blocks (json-rules) | **Yes** | JSX conditionals | Handlebars `{{#if}}` | Mustachio | Custom |
| Communication categories | **Yes** (system/promotional + unsubscribe control) | No | Partial | Message streams | Custom |
| MJML cross-client rendering | **Yes** | React Email (less tested) | Raw HTML | Raw HTML | Custom |
| Runtime template editing (no deploy) | **Yes** | No | Yes (dashboard) | Yes (dashboard) | Custom |
| White-labeling per tenant | **Yes** (org/space overrides) | No | No | No | Rare |

### Honest assessment
The email system's architecture is ahead of most growth-stage companies. The 4-level ownership cascade is designed for white-labeling — an org can override the default email template, and a space can override the org's. The json-rules conditional blocks are novel. The MJML rendering pipeline with recursive component expansion is production-ready. What's missing: full email sending is not yet wired for production (Resend client exists but the delivery pipeline needs completion for all template types).

---

## 11. WebSocket Infrastructure

### What the template provides
Native Bun WebSocket with Hono integration, token-based auth via query params, connection lifecycle management with three index maps (by ID, by user, by channel), Redis pub/sub for horizontal scaling across server instances, graceful shutdown with reconnect messages, 5-minute keepalive timeout with stale connection cleanup every 60 seconds, event system integration (app events auto-broadcast via WebSocket).

### Comparison

| Feature | Template | Socket.io | Pusher | Ably | Supabase Realtime |
|---------|----------|-----------|--------|------|-------------------|
| Performance | ~611K msgs/sec (Bun native) | Lower (abstraction overhead) | Managed | Managed | 224K msgs/sec |
| Horizontal scaling | Redis pub/sub | Redis adapter | Managed | Managed | Managed |
| Channel subscriptions | Yes | Rooms + namespaces | Channels | Channels | Channels |
| Auth | Bearer token in query | Middleware | App key + auth endpoint | Token-based | JWT |
| Auto-reconnect | Client-side | **Built-in** | **Built-in** | **Built-in** | **Built-in** |
| Graceful shutdown | Yes (reconnect msg) | Via adapter | Managed | Managed | Managed |
| Event system integration | **Yes** (auto-broadcast) | Manual | Manual | Manual | DB-driven |
| Zero vendor lock-in | **Yes** | Yes | No | No | Partial |
| Zero additional cost | **Yes** | Yes | Per-message pricing | Per-message pricing | Per-connection pricing |

### Honest assessment
The WebSocket layer is a solid foundation — the Redis pub/sub pattern for horizontal scaling is the industry standard. The auto-broadcast from the event system (`createAppEvent()` → WebSocket push via wildcard handler) is a nice integration. This is explicitly described as infrastructure rather than a complete real-time feature set. No presence channels, no typing indicators, no message history. Add those as your domain requires.

---

## 12. Multi-Tenancy

### What the template provides
Four-context model: Organization → Space with OrganizationUser/SpaceUser join tables. Hierarchical token scoping (User cross-org, Organization all-spaces, Space single-space). Context switching in frontend with auto-navigation and URL sync. Context-aware menu rendering based on permissions. Three separate frontend apps (web, admin, superadmin) sharing UI components.

### Comparison

| Feature | Template | Supabase RLS | Schema-per-tenant | Database-per-tenant (Neon) | NestJS tenancy libs |
|---------|----------|-------------|-------------------|---------------------------|---------------------|
| Tenant hierarchy (Org → Space) | **Yes** (3-tier) | Flat (tenant_id) | Flat | Flat | Flat |
| Hierarchical token scoping | **Yes** | Via JWT claims | Custom | Custom | Custom |
| Frontend context switching | **Yes** (ContextSelector + URL sync) | No | No | No | No |
| Permission-aware navigation | **Yes** | Via RLS | Custom | Custom | Custom |
| Cross-org user access | **Yes** (User-scope token) | Custom | Complex | Complex | Custom |
| Isolation mechanism | Application-level (FK filtering) | Database-level (RLS) | Schema-level | Full DB isolation | Varies |

### Honest assessment
The template's multi-tenancy is application-level, not database-level. This is the right choice for most SaaS apps — it's simpler, more flexible, and supports the hierarchical org → space model that schema-per-tenant can't. The trade-off: you're the isolation layer, not the database. A bug that drops `WHERE organizationId = ?` is a data leak. The permission middleware and token scoping mitigate this, but there's no row-level database safety net.

For enterprise customers requiring database-level isolation, a hybrid approach works: application-level for standard tenants, Neon database-per-tenant for enterprise.

---

## 13. Developer Experience

### What the template provides
Turborepo + Bun monorepo with 4 apps + 5 packages. Biome for linting/formatting (10-25x faster than ESLint+Prettier). Bun test runner with 93 test files. Test factories with Faker, auto-inferred relationships, and smart cleanup (only truncates modified tables). OpenAPI SDK auto-generation from route definitions. Prisma + Zod auto-generation from schema. Route tree generation. MSW handler auto-generation from SDK. Custom CI lint rules with their own pass/fail test fixtures. `<100ms` hot reload. Path aliases. React/Ink TUI init script with 13 setup tasks and prerequisite validation.

### Comparison

| Feature | Template | Create-T3-App | Nx monorepo | Next.js starter | Typical SaaS boilerplate |
|---------|----------|---------------|-------------|-----------------|--------------------------|
| Monorepo (4 apps + 5 packages) | **Yes** | Single app | Yes | Single app | Usually single app |
| Linting speed | Biome (10-25x faster) | ESLint + Prettier | ESLint + Prettier | ESLint | ESLint |
| Test factories with relationship inference | **Yes** | No | No | No | No |
| Smart test cleanup (only modified tables) | **Yes** | No | No | No | Truncate all |
| OpenAPI → SDK auto-generation | **Yes** | tRPC (no OpenAPI) | Manual | Manual | Manual |
| CI lint rules with pass/fail fixtures | **Yes** | No | Boundary rules | No | No |
| Guided infrastructure setup (TUI) | **Yes** (13-task React/Ink app) | CLI wizard | `nx init` | `create-next-app` | README instructions |
| Code generation pipeline (schema → types → spec → SDK) | **Yes** | Partial (tRPC) | Custom | Manual | No |
| MSW handler generation from API spec | **Yes** | No | No | No | No |

### Honest assessment
The DX tooling is comprehensive. The code generation pipeline (Prisma schema → Zod schemas → OpenAPI spec → TypeScript SDK → MSW mock handlers) creates a single source of truth that cascades changes automatically. The test infrastructure — factories with dependency inference, smart table tracking, serialized factories for UI tests — is more sophisticated than what most Series A companies have. The CI lint rules with their own test fixtures (checking that rules correctly detect violations) is an unusually disciplined approach.

The init script is more than a rename tool — it's a 13-task TUI application that validates prerequisites, sets up Infisical secrets, provisions databases, configures hosting, and generates documentation. This is what makes the template usable from day one rather than requiring a week of setup.

---

## 14. Observability & Infrastructure

### What the template provides
Consola logging wrapper with 12 log scopes and request ID correlation. OpenTelemetry with OTLP export and auto-instrumentation of HTTP + Prisma (dynamic imports prevent overhead when disabled). Infisical for secrets management with three environments. Redis with IORedis singleton connections, automatic reconnection, namespacing (7 namespaces), and separate connections for main/pub-sub/BullMQ. Docker Compose with health checks. Database dump/restore/clone scripts. Environment validation with Zod at startup.

### Comparison

| Feature | Template | Typical startup | Growth-stage | Enterprise |
|---------|----------|-----------------|--------------|------------|
| Structured logging with scopes | **Yes** (12 scopes, Consola) | `console.log` | Pino/Winston | Centralized (ELK/Datadog) |
| Request ID correlation | **Yes** | No | Usually | Yes |
| OpenTelemetry instrumentation | **Yes** (HTTP + Prisma) | No | Partial | Full |
| Secrets management | Infisical (3 envs) | `.env` files | Doppler/Infisical | Vault |
| Redis namespacing | **Yes** (7 namespaces) | Single flat namespace | Partial | Yes |
| Env validation at startup | **Yes** (Zod) | No | Partial | Yes |
| DB operations (dump/restore/clone) | **Yes** | Manual pg_dump | Custom scripts | Managed |

### Honest assessment
The observability foundation is correct but has scaling boundaries. **Consola is unconventional for production APIs** — it excels at developer experience (pretty terminal output, scoped loggers) but lacks Pino's async logging and worker thread architecture. At high request volumes (1000+ RPS), Consola may create event loop pressure. Migration to Pino would preserve the 12 scope names and request ID correlation pattern.

OpenTelemetry instrumentation is the right 2025 approach — instrument once, choose backends later. The dynamic import preventing overhead when disabled is a thoughtful optimization (OTel auto-instrumentation adds 5-15% overhead).

---

## 15. Middleware & Request Pipeline

### What the template provides
11-step middleware chain executing in order: CORS (environment-specific wildcard patterns for preview deploys) → session auth (BetterAuth) → token auth (SHA-256 lookup with Redis cache) → superadmin spoofing → request preparation (requestId, fresh Permix instance, DB scope, batch context cloning) → rate limiting (per-token or IP-based, Redis-backed 1-second windows) → resource context loading (auto-load by ID with `?lookup=` for alternate fields) → actor/user validation → permission validation (ReBAC traversal with cycle detection) → searchable field constraints → route handler. Plus a global error handler (Sentry for 5xx) and 404 handler.

### Comparison

| Feature | Template | Express middleware | NestJS guards/pipes | Hono (raw) | Typical Startup |
|---------|----------|-------------------|---------------------|------------|-----------------|
| Defined execution order (11 steps) | **Yes** | User-defined | Lifecycle hooks | User-defined | Ad-hoc, often misordered |
| Batch context isolation (deep clone per sub-request) | **Yes** | No | No | No | No |
| Resource auto-loading with custom lookup fields | **Yes** (`?lookup=slug`) | Manual | Pipes (manual) | Manual | `findById` in every controller |
| Rate limiting (per-token configurable + IP fallback) | **Yes** | express-rate-limit | @nestjs/throttler | Community | Global rate limit if any |
| Request ID on every request + response header | **Yes** | Manual | Manual | Manual | Sometimes |
| Permission middleware with ReBAC traversal | **Yes** | Manual | Custom guards | Manual | `if (user.role)` checks |
| Polymorphic owner permission validation | **Yes** | No | No | No | No |
| 6 validation middlewares (actor, user, superadmin, notToken, permission, ownerPermission) | **Yes** | Custom | Guards (similar) | Custom | 1-2 auth checks at most |
| Graceful shutdown with handler registry | **Yes** (30s timeout) | Manual | `onModuleDestroy` | Manual | `process.on('SIGTERM', ...)` |

### Honest assessment
The middleware stack is one of the template's strongest practical features. The defined execution order prevents the class of bugs where auth runs after resource loading, or rate limiting runs before the token is resolved. Batch context isolation (deep cloning mutable state per sub-request while sharing immutable app metadata) is essential for the batch API but invisible to most users. The 6 validation middleware factories mean route definitions read like declarations: `validateActor`, `validatePermission('manage')`, `validateOwnerPermission({ action: 'own' })`.

---

## 16. Shared Utilities & Cross-Cutting Concerns

### What the template provides
`resolveAll()` concurrency limiter with 6 typed limits (DB: 10, Redis: 50, Queue: 100, Socket: 100, AppEvent: 100, Integration: 5), environment detection (5 environments with type guards), `cn()` for Tailwind class merging, URL search param utilities (parse, pick, read, build), Consola-based logger with AsyncLocalStorage scope injection (11 log scopes: api, db, worker, seed, ws, test, auth, cache, hook, job, email), frontend logger factory, false polymorphism registry (6 models with axis-based constraint generation), test tracker (automatic table cleanup via mutation tracking with TRUNCATE CASCADE), 15 test factories with auto-inferred relationships and serialization.

### Why this matters

Most of these utilities seem small in isolation. Together, they eliminate entire categories of bugs:

| Utility | What it prevents |
|---------|------------------|
| `resolveAll()` with typed limits | Database connection exhaustion from unbounded parallel queries |
| Environment type guards | `if (process.env.NODE_ENV === 'prodution')` typos (compile-time catch) |
| Logger with ALS scope injection | Logs without context ("which request caused this?") |
| Test tracker + TRUNCATE CASCADE | Slow test suites from truncating all tables (only cleans modified ones) |
| 15 factories with relationship inference | 20-line test setup boilerplate per test (1 line with factories) |
| False polymorphism registry | Invalid FK combinations at runtime (Token owned by User but with spaceId set) |
| Immutable field auto-inference from FKs | Accidental FK reassignment (moving a space to a different org) |

### Honest assessment
These are the "invisible infrastructure" pieces that separate a maintained codebase from a fragile one. None of them are individually impressive. All of them together mean that a new developer joining the project has guardrails against the most common classes of bugs — without reading a single line of documentation.

---

## 17. Frontend Architecture

### What the template provides
React 19 + Vite 7 + TanStack Router (file-based, type-safe) + TanStack Query v5 + Zustand (6 slices) + shadcn. Three frontend apps sharing components from `packages/ui`. Declarative navigation with permission-based rendering. Context-aware routing with URL sync. Route guards. 20+ custom hooks. 13 shared pages. Optimistic mutations with rollback. WebSocket-driven cache invalidation (`useEventRefetch`). Per-space CSS theming for white-labeling. Error guidance categories in global toast system. Auto-generated API SDK + MSW mock handlers.

### Comparison

| Feature | Template | Next.js starter | Create-T3-App | Typical SaaS boilerplate |
|---------|----------|-----------------|---------------|--------------------------|
| Type-safe file-based routing | **Yes** (TanStack Router) | App Router | tRPC | React Router |
| Permission-gated navigation | **Yes** (declarative) | Manual | Manual | Manual |
| Context switching (org/space) | **Yes** (URL-synced) | Manual | Manual | Manual |
| Optimistic mutations with rollback | **Yes** (generic + list-specific) | Manual | Manual | Manual |
| WebSocket-driven cache invalidation | **Yes** (`useEventRefetch`) | No | No | No |
| Per-tenant theming (CSS vars) | **Yes** (`useSpaceTheme`) | No | No | No |
| Shared pages across apps | **Yes** (13 pages in packages/ui) | N/A (single app) | N/A | No |
| Error guidance in toasts | **Yes** (6 guidance categories) | No | No | No |
| Auto-generated mock handlers | **Yes** (MSW from OpenAPI) | No | No | No |
| Multiple admin frontends | **Yes** (web + admin + superadmin) | No | No | Rare |

### The six Zustand slices

Most SaaS apps use a single global store or scatter state across dozens of React contexts. The template's 6 slices provide modular, typed, cross-cutting state:

| Slice | Manages | Key non-trivial pattern |
|-------|---------|------------------------|
| **Auth** | User, orgs, spaces, tokens, spoof mode | Multi-step hydration, cascading logout (clears permissions + tenant), embed mode for iframes |
| **Client** | TanStack Query client with global error handler | Guidance-based error routing — maps API `guidance` field to toast actions (login button, refresh, contact support) |
| **Navigation** | Router function, nav config, route match | Three search param preservation policies (context, spoof, all) for multi-tenant URL management |
| **Permissions** | Permix instance with RBAC + ReBAC | Mirrors backend permission logic — superadmin bypass, org roles, space roles, entitlements intersection |
| **Tenant** | Active context (public/user/org/space) + page metadata | Context switching with validation against auth state, breadcrumb label generation |
| **UI** | Theme, loading, app branding from env vars | System theme detection, localStorage persistence |

### The 17+ custom hooks

| Hook | What it does | Why it matters |
|------|-------------|----------------|
| **useAuthenticatedRouting** | Syncs URL params ↔ tenant context ↔ permissions | The backbone of multi-tenant routing — validates access, auto-redirects on context change |
| **useOptimisticMutation** | Three-phase optimistic updates (snapshot → update → rollback or settle) | Generic pattern wrapping TanStack mutations with proper cache management |
| **useOptimisticListMutation** | Specialized list CRUD with temporary `__optimistic__` IDs | Handles create/update/delete on lists, unwraps SDK responses, merges extras |
| **useEventRefetch** | Invalidates queries when WebSocket events match wildcard/regex rules | Real-time cache invalidation without manual subscription management |
| **useAppEvents** | WebSocket connection with auto-reconnect, channel subscriptions, event buffer | Foundation for real-time features — handles lifecycle, reconnection, message parsing |
| **usePermission** | Returns `{show, disable, disabledText}` for UI permission gating | Drives button/action visibility declaratively from ReBAC schema |
| **useValidateUniqueness** | Async field uniqueness validation with debounce | Calls API with `?lookup=field`, handles 404 as "available", caches 5s |
| **useSpaceTheme** | Applies per-space CSS custom properties (`--space-*`) | White-labeling — cleans previous vars, wraps URLs for logo/favicon |
| **useBreadcrumbs** | Generates breadcrumb trail from route match + tenant context | Context-aware labels pulling from page metadata |
| **usePageMeta** | Sets `document.title` and meta description from routes | Supports function-based titles that resolve against tenant context |
| **useAuthStrategy** | Detects embed vs login mode, handles postMessage token flow | Iframe embedding support — parent window injects auth token |
| **useAuthProviders** | Fetches platform or org-specific OAuth providers | Switches endpoints based on org context |
| **useDarkMode** | Applies `dark` class to document root respecting system preference | Simple but correct — handles `prefers-color-scheme` media query |
| **useThemePersistence** | Syncs theme to/from localStorage | Hydrates on mount, persists on change |
| **useMediaQuery** / **useBreakpoint** | Responsive design queries with Tailwind breakpoint mapping | Standard pattern, well-typed |
| **useDebounce** / **useDebouncedCallback** | Value and callback debouncing | Proper cleanup on unmount |

### 13 shared pages across 3 apps

The template ships three frontend apps (web, admin, superadmin) that share pages from `packages/ui`:

Authentication: `HomePage`, `LoginPage`, `SignupPage`. Organization management: `OrganizationsPage`, `OrganizationProfilePage`, `OrganizationUsersPage`, `OrganizationSpacesPage`, `OrganizationAuthProvidersPage`. User: `ProfilePage`, `UserProfilePage`. Tokens and webhooks: `TokensPage`, `WebhooksPage` (both context-aware — dynamically select API endpoints based on tenant context type). Space: `SpaceProfilePage`.

### Honest assessment
The frontend architecture choices align with 2025-2026 ecosystem consensus: Vite for dashboards behind auth, Zustand for client state, TanStack Query for server state, TanStack Router for type-safe routing, shadcn for components. The template adds significant custom value on top: the guidance-based error routing in the client slice, the three-policy navigation preservation, the event-driven cache invalidation via WebSocket, the embed mode auth flow for iframe scenarios, and the shared page architecture across three apps.

The shadcn dependency on Radix primitives has a noted risk — Radix was recently announced as not actively maintained. Since shadcn components are copied into your codebase (not imported as dependencies), this is a migration concern, not an immediate breakage risk.

---

## Summary: Where the Template Stands

### Features no alternative provides

| Feature | Why it's unique |
|---------|----------------|
| Transaction-aware hooks with rollback | No ORM fires hooks inside transactions that roll back with them |
| Post-commit side effects (`db.onCommit()`) | Only Sequelize has native `afterCommit`; no ORM combines this with transaction-aware hooks |
| Ordered mutation lifecycle (rules → immutable fields → write → cache → webhooks) | No framework provides a declarative hook pipeline with ordered execution inside transactions |
| json-rules → Prisma/SQL from single AST | Write a rule once, evaluate at runtime, query the database, or generate raw SQL |
| Per-field encryption versioning + AAD binding | No encryption service tracks versions per-field per-record with ciphertext binding |
| Hierarchical token scopes (User/Org/Space) | No auth service provides three-tier token scoping |
| Guidance-driven error pipeline (API → toast with contextual actions) | No framework maps structured error guidance to frontend UI behavior end-to-end |
| Transaction-aware event emission | No in-process event library defers handlers until transaction commits |
| Batch API with 4 strategies + interpolation | Industry standard is 2 strategies with no interpolation |
| Bracket query (pseudo-GraphQL over REST) | No REST framework provides this depth of flexible querying |
| 4-level email template ownership cascade | No email service supports default → admin → org → space overrides |
| Cross-system transactional consistency | Everything in one DB means permissions + jobs + webhooks + email in one transaction |

### Where the template matches best-in-class

| System | Comparable to |
|--------|--------------|
| Auth foundation | BetterAuth + custom extensions (competitive with Clerk/Auth0 feature set, self-hosted) |
| Permissions | Permify + Permix (comparable to SpiceDB/OpenFGA with better DX) |
| Job queue | BullMQ with production patterns (comparable to Trigger.dev/Inngest minus managed infrastructure) |
| Error handling | Structured error pipeline (ahead of most frameworks' ad-hoc approach) |
| Event system | Transaction-aware in-process events (simple but correct) |
| WebSocket | Bun native + Redis pub/sub (comparable to Socket.io Redis adapter, faster) |
| Middleware | 11-step ordered pipeline (comparable to NestJS lifecycle, more explicit) |
| Frontend stack | React 19 + Vite + TanStack + 6 Zustand slices + 17 custom hooks (well beyond typical starters) |
| DX tooling | Turborepo + Biome + Bun + 15 test factories + CI lint rules (fast, modern, comprehensive) |

### Where the template has room to grow

| Area | Current state | Path forward |
|------|---------------|--------------|
| Logging | Consola (DX-focused, not high-throughput) | Migrate to Pino for production scale |
| MFA | Not implemented | BetterAuth has MFA plugins |
| Self-serve SSO portal | Not implemented | WorkOS-style customer admin portal |
| E2E tests | Not implemented | Playwright |
| Webhook signing | RSA-SHA256 | Standard Webhooks spec (HMAC-SHA256) |
| Email delivery | Resend client exists, pipeline not fully wired | Complete integration |
| File management | Pre-signed URL service exists | Upload pipeline + storage management |
| Payments | Stripe client exists | Subscription billing flow |
| Event persistence | In-memory only | Durable event store for audit/replay |
| Frontend error boundary | Basic implementation | Route-level boundaries with recovery UI |
