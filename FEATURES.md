# Template Features

<!-- toc:start -->

## Contents

- [How to Read This](#how-to-read-this)
- [Core Platform](#core-platform)
- [API Architecture & Routing](#api-architecture--routing)
- [Authentication & Sessions](#authentication--sessions)
  - [Session Authentication (BetterAuth)](#session-authentication-betterauth)
  - [Multi-Provider Auth (AuthProvider)](#multi-provider-auth-authprovider)
  - [Token Authentication](#token-authentication)
  - [User Impersonation](#user-impersonation)
  - [Roadmap](#roadmap)
- [Authorization & Permissions](#authorization--permissions)
- [Multi-Tenancy](#multi-tenancy)
- [Database & ORM](#database--orm)
- [Admin Operations](#admin-operations)
- [Background Jobs & Cron](#background-jobs--cron)
- [Webhooks](#webhooks)
- [Real-Time Communication](#real-time-communication)
- [Email System](#email-system)
- [Encryption & Security](#encryption--security)
  - [Field-Level Encryption Engine](#field-level-encryption-engine)
  - [General Security](#general-security)
- [User Management](#user-management)
- [Inquiry System](#inquiry-system)
- [Contact System](#contact-system)
- [Customer Management](#customer-management)
- [Frontend Apps](#frontend-apps)
- [Frontend Architecture](#frontend-architecture)
- [UI Components](#ui-components)
  - [Done (Primitives)](#done-primitives)
  - [In Progress](#in-progress)
- [Frontend Hooks](#frontend-hooks)
- [Developer Experience](#developer-experience)
  - [Development Workflow](#development-workflow)
  - [Testing & Quality](#testing--quality)
  - [Type Safety & Code Generation](#type-safety--code-generation)
  - [Linting & Formatting](#linting--formatting)
  - [Boilerplate Reduction](#boilerplate-reduction)
- [Infrastructure & DevOps](#infrastructure--devops)
  - [Logging & Observability](#logging--observability)
  - [Environment & Secrets](#environment--secrets)
  - [Caching & Performance](#caching--performance)
  - [Database Operations](#database-operations)
  - [Coming Soon](#coming-soon)
- [Architectural Patterns](#architectural-patterns)
- [Coming Soon (Ticketed Roadmap)](#coming-soon-ticketed-roadmap)
- [Statistics](#statistics)
- [Tech Stack](#tech-stack)
- [🎯 Unique Selling Points](#unique-selling-points)

<!-- toc:end -->

Comprehensive SaaS starter template with multi-tenancy, ReBAC permissions, and modern TypeScript stack.

**Last Updated:** 2026-06-09

## How to Read This

- **✅ Complete** - Feature is implemented and tested
- **🟡 In Progress** - Actively being developed, partial implementation exists
- **🟣 Coming Soon** - Planned work with tickets (see Coming Soon section for full roadmap)

**Looking for something specific?** Use browser search (Cmd+F / Ctrl+F) to find features by keyword. For a side-by-side comparison against managed services and open-source alternatives, see [COMPARISONS.md](./COMPARISONS.md).

---

## Core Platform

- ✅ **Monorepo Architecture** - 4 apps (`web`, `admin`, `superadmin`, `api`) + shared packages (`db`, `ui`, `email`, `shared`). Workspace-level scripts for build, typecheck, lint, and test across all packages simultaneously
- ✅ **Bun Runtime** - Bun 1.3+ as runtime and package manager. Native `--hot` flag for sub-100ms API reloads. Faster installs, faster test runs, faster builds than Node/npm
- ✅ **Turborepo Orchestration** - Task graph with caching: unchanged packages skip work. `turbo watch local` runs all apps; `turbo watch local#api` filters to one. Cross-package hot reload — change shared UI package, all consuming apps reload instantly
- ✅ **Workspace Tooling** - Single `bun run lint`, `bun run typecheck`, `bun run test` at root runs across all packages. Task dependencies ensure build order (db → shared → ui → apps)
- ✅ **Multi-Environment Setup** - Three environments: `pr` (ephemeral per PR), `staging`, `prod`. Each has isolated Infisical project, database, and Redis. PR environments auto-cleaned on merge
- ✅ **Environment Composition** - `with-env.sh` injects secrets at runtime: `bun run with prod api turbo watch local#api` runs local code against production secrets. No committed `.env` files
- ✅ **Docker Compose** - PostgreSQL 18 (alpine) and Redis 7 (alpine) for local dev. Persistent volumes, health checks, auto-restart. Bun servers run natively via Turborepo, not containerized
- ✅ **TypeScript Strict Mode** - `strict: true` + additional checks across all packages. `any` avoided in application code (rare casts only at framework/type boundaries), enforced null checks, proper error handling. Catches entire classes of bugs at compile time
- 🟡 **Init Script** - React Ink TUI for automated project setup (rename, secrets, cloud provisioning). Core flow complete; PlanetScale, Infisical, Railway integrations working. Additional provider integrations in progress

---

## API Architecture & Routing

**Modern RESTful API with GraphQL-style querying** - Built on Hono with full OpenAPI 3.1 spec generation, type-safe routing, and pseudo-GraphQL filtering that gives you the flexibility of GraphQL queries without the complexity. Every endpoint is documented, validated, and generates type-safe client code automatically.

- ✅ **File-Based Route Auto-Registration** - Drop route file in `routes/` and matching controller in `controllers/` - automatically registered on startup. `autoRegisterRoutes()` scans module directory, imports route+controller pairs, and registers them with router. No manual imports needed. Prefix-based filtering separates admin routes from public routes. Similar to Next.js/TanStack file-based routing but for backend APIs

- ✅ **Route Templates** - Pre-built route creators (readRoute, createRoute, updateRoute, deleteRoute, actionRoute) that generate consistent OpenAPI 3.1 definitions with proper schemas, error handling, and type safety. Eliminates ~70% of API boilerplate while enforcing consistent patterns across all endpoints. One file per endpoint for clean organization. [Learn more: API_ROUTES.md](docs/claude/API_ROUTES.md)

- ✅ **makeController()** - Controller factory that generates type-safe responder functions based on route's declared responses. Automatically validates response data against OpenAPI schema before sending (catches bugs where controller returns wrong shape). Provides clean API: `respond.ok(data, metadata?)`, `respond.created(data, location?)`, `respond.noContent()`. Responders only available if route declares that status code - TypeScript prevents `respond.created()` if route only has 200 response

- ✅ **makeError()** - Error factory that creates throwable HTTPException with standardized error body `{ error, message, guidance, fieldErrors?, requestId }`. Uses HTTP_ERROR_MAP for default messages and user-friendly guidance per status code. Supports field-level validation errors for form integration. Includes requestId for log correlation. One function replaces dozens of manual error constructions

- ✅ **Pseudo-GraphQL Filtering** - Powerful query syntax without GraphQL complexity. Use bracket notation (`?filter[status]=active`), path notation for nested fields (`?filter[user.email]=john@example.com`), comparison operators (`?filter[age][gte]=18`), and combine multiple filters. Much more flexible than basic REST while remaining URL-based and cacheable.

- ✅ **Pagination System** - Cursor-based and offset-based pagination with full metadata (total count, hasMore, nextCursor). Includes `paginate()` utility that handles all the math - just pass your query and page size. Route templates have built-in pagination support with standardized query params. Response includes pagination metadata so clients can build "Load More" or page navigation without guessing.

- ✅ **Standardized Response Shape** - Route templates enforce consistent structure: `{ data, pagination, error? }`. Every endpoint returns the same shape automatically, so your frontend handles all API responses with the same code and TypeScript knows exactly what to expect. Errors include guidance text to help users fix issues. No manual response formatting needed.

- ✅ **Resource Context Middleware** - Routes with `:id` params auto-load the resource into request context using `getResource()`. Supports custom lookup queries (find by email, slug, etc.) and Prisma `include` options per route. No more fetching the same record in middleware and controller. Handles 404s automatically if resource doesn't exist.

- ✅ **Request Context Scoping** - Every request gets isolated context (AppEnv) containing db client, authenticated user, current org/space, and permissions. Context flows through all middleware and controllers without manual passing. Prevents cross-tenant data leaks since context is scoped per-request.

- ✅ **Batch API** - Execute multiple operations in a single HTTP request with 4 execution strategies: **transactionAll** (atomic all-or-nothing), **transactionPerRound** (each round atomic, earlier rounds stay committed), **allowFailures** (continue on errors, best for bulk operations), and **failOnRound** (stop after first failing round). Use `<<roundIndex.requestIndex.path>>` interpolation to reference previous results (create user, then create org membership using `<<0.0.body.data.id>>`). Enables complex multi-step workflows in a single round-trip. [Learn more: BATCH.md](docs/claude/BATCH.md)

- ✅ **OpenAPI 3.1 Spec Generation** - Full OpenAPI 3.1 specifications auto-generated from route definitions. Interactive Scalar UI documentation at `/docs` with request/response examples, type information, and "Try It" functionality. Spec includes all schemas, authentication, error responses, and examples.

- ✅ **Type-Safe SDK Generation** - TypeScript client SDK auto-generated from OpenAPI spec with full type inference. Every endpoint becomes a typed function with request/response types, eliminating manual API client code. Includes TanStack Query hooks and query keys for seamless React integration.

- ✅ **Unified Error Contract** - All errors follow the same shape: `{ error, message, guidance, fieldErrors?, requestId }`. Zod validation errors auto-map to `fieldErrors` for form integration. Request ID ties frontend errors to backend logs for debugging. Guidance field helps users fix common mistakes.

- ✅ **Modules Constant** - Type-safe model name registry prevents typos in route definitions. Use `Modules.organization` instead of `'organizations'` string to catch errors at compile time.

- ✅ **72+ REST Endpoints** - Comprehensive API coverage across all modules with consistent patterns and full documentation

---

## Authentication & Sessions

### Session Authentication (BetterAuth)

- ✅ **BetterAuth Integration** - JWT and token auth via BetterAuth ^1.5. Handles email/password, OAuth, verification flows, and session lifecycle out of the box
- ✅ **Email/Password Auth** - bcrypt password hashing. On sign-in, BetterAuth issues a **stateless JWT stored in an HTTP-only cookie**. No server-side session — the JWT is the session. CSRF protection via BetterAuth's double-submit cookie pattern
- ✅ **OAuth Flow → Bearer Token** - OAuth callback (`/auth/callback`) extracts the returned JWT from the URL param and stores it in **localStorage** via `setToken()`. All subsequent API requests send it as `Authorization: Bearer <token>`. No cookie involved for OAuth users
- ✅ **Stateless JWT** - No server-side session storage. Both email/password (cookie) and OAuth (localStorage Bearer) use the same JWT format. `cookieCache.maxAge: 300` means BetterAuth skips DB validation for up to 5 minutes per JWT
- ✅ **Redis Secondary Storage** - Frequently-accessed data (permission caches, org lists) cached in Redis. Not the primary auth store — JWTs are self-contained
- ✅ **OAuth Social Providers** - Google wired via BetterAuth social plugin (callback handling, account linking, token issuance). Microsoft/GitHub are scaffolded in `platformProviders` but not yet configured in the BetterAuth client — adding them is config, not code
- ✅ **BetterAuth Models** - Session (persisted for revocation), Verification (email verification tokens), Account (OAuth provider linkage) models in Prisma

### Multi-Provider Auth (AuthProvider)

- ✅ **AuthProvider Model** - Organizations configure their own OAuth/SAML providers (client ID, encrypted secret, callback URL, scopes). Users authenticate via the org's configured provider
- ✅ **Platform Providers** - Providers marked `platformDefault: true` are available to all organizations. Enables centrally-managed SSO configs without per-org setup
- ✅ **Encrypted Secrets** - OAuth client secrets stored with AES-256-GCM encryption at rest. Key rotation via version tracking. Secret never returned in API responses
- ✅ **Full CRUD API** - Create, read, update, delete auth providers via API. Admin routes for platform providers, organization routes for org-specific configs

### Token Authentication

- ✅ **Bearer Token Auth** - `Authorization: Bearer <key>` header for API access. SHA-256 hashed at rest. 10-minute Redis cache for frequently-used tokens avoids DB lookup per request
- ✅ **URL Token Fallback** - `?token=<key>` query param for contexts that can't set headers (WebSocket upgrades, email links). Same validation pipeline as Bearer tokens
- ✅ **Hierarchical Token Scopes** - Tokens scoped to User (cross-org), Organization (all spaces in org), or Space (single space only). Scope determines which resources the token can access
- ✅ **Personal Access Tokens** - Users create named tokens with optional expiry dates. Token value shown once at creation, only hash stored. Usage tracking updates `lastUsedAt` on every request
- ✅ **Token CRUD** - Full lifecycle management. List tokens (with last-used metadata), create with name+expiry, delete by ID. Tokens scoped to the owning User/Org/Space

### User Impersonation

- ✅ **Superadmin Spoofing** - Superadmins send `x-spoof-user-email` header to impersonate any user. Middleware resolves the target user and swaps auth context. Full access to impersonated user's orgs and permissions
- ✅ **Spoof Response Headers** - API responds with `x-spoofing-user-email` (impersonator) and `x-spoofed-user-email` (target) for auditability. Frontend reads these to show the spoof badge
- ✅ **Spoof Badge UI** - Yellow banner in AppShell when spoofing is active. Shows impersonated user's email and "Clear Spoof" button that removes the header and refreshes

### Roadmap

- 🟡 **Session Refresh** - Silent re-authentication when session expires. Token refresh flow and auto-retry on 401 not yet implemented
- 🟣 **SAML/SSO** (ticket AUTH-001) - Schema and encryption infrastructure ready. Awaiting BetterAuth SAML plugin maturity for production-ready SAML 2.0 support

---

## Authorization & Permissions

**Full RBAC/ABAC/ReBAC Authorization** - Comprehensive permission system supporting Role-Based (RBAC), Attribute-Based (ABAC), and Relationship-Based (ReBAC) access control powered by Permix with JSON-Rules support. This unified system lets you define permissions using simple roles, complex attribute-based rules, or relationship graphs - all within the same framework. JSON-Rules integration enables dynamic permission logic without code deployment.

- ✅ **Multi-Level RBAC** - Roles at platform (superadmin, user), organization (owner, admin, member), and space (owner, admin, member) levels with clear hierarchies

- ✅ **Attribute-Based Control (ABAC)** - JSON-based entitlements at org and space level allow custom permission logic based on user attributes, resource properties, or contextual conditions

- ✅ **Relationship-Based Control (ReBAC)** - Google Zanzibar-style relationship graphs (User → OrgUser → Org → Space) for modeling complex permission scenarios like delegated access or inherited permissions

- ✅ **JSON-Rules Integration** - Define permission logic declaratively using @inixiative/json-rules without code deployment. Evaluate complex conditions, combine multiple rules, and update permission logic dynamically

- ✅ **Hierarchical Inheritance** - Space permissions automatically inherit from parent organization. Org owners automatically get owner access to all spaces

- ✅ **Permission Middleware** - validatePermission() and validateOwnerPermission() enforce checks before controller execution. Routes declare required permissions in OpenAPI definitions

- ✅ **Superadmin Bypass** - Platform superadmins bypass all permission checks for support scenarios while maintaining audit trails

- ✅ **Context Scoping** - Permission checks automatically scoped to current organization and space contexts. Prevents cross-tenant permission leaks

- ✅ **Per-Request Isolation** - Fresh Permix client instance per request ensures complete isolation between concurrent requests

- ✅ **Redis Performance Caching** - Permission evaluation results cached in Redis (10min TTL) for sub-millisecond response times

- 🟣 Visual permissions builder UX (ticket FEAT-008, depends on INFRA-002)

[Learn more: PERMISSIONS.md](docs/claude/PERMISSIONS.md)

---

## Multi-Tenancy

**Four-Context Architecture** - User, Organization, Space, and Public contexts with seamless switching, hierarchical permissions, and complete data isolation. Each context has its own navigation, routes, and permissions while sharing a unified state management system.

- ✅ **Organizations** - Top-level tenant containers with full CRUD, settings, custom auth providers, and organization-scoped tokens. Complete data isolation ensures one org cannot access another's data

- ✅ **Organization Memberships** - OrganizationUser join table with roles (owner, admin, member) and role management. Users can belong to multiple organizations
- 🟡 **Invitation System** - Email-based invitations to organizations (in progress)

- ✅ **Spaces** - Flexible sub-containers within organizations for projects, teams, or workspaces. Full CRUD operations with data isolation from other spaces in the same org

- ✅ **Space Memberships** - SpaceUser join table requiring org membership first. Space access is always a subset of org access - can't be in a space without being in its parent org

- ✅ **Hierarchical Tokens** - Tokens scoped to User (cross-org access), Organization (all spaces in org), or Space (single space only). Token scope determines accessible resources

- ✅ **Context Switching** - Frontend seamlessly switches between User, Organization, Space, and Public contexts. Each context has appropriate navigation, routes, and data access

- ✅ **URL State Sync** - Current context tracked in URL params (`?org=orgId`, `?space=spaceId`). Enables shareable links that preserve context and proper back/forward navigation

- ✅ **Context-Aware Navigation** - Navigation menus automatically show/hide items based on current context and user permissions. Organization menu only shows in org context, space menu only in space context

- ✅ **State Management** - Frontend store tracks current user, active organization, active space, and public state. All components access context through centralized store

[Learn more: FRONTEND.md](docs/claude/FRONTEND.md) | [APPS.md](docs/claude/APPS.md)

---

## Database & ORM

**Prisma 7 with Advanced Patterns** - Latest Prisma ORM with PostgreSQL 18, featuring typed model IDs, mutation hooks, post-transaction queues, robust false polymorphism, and split schema architecture. Built for type safety, testability, and maintainability.

- ✅ **Typed Model IDs** - Branded ID types (OrganizationId, UserId, SpaceId) prevent accidentally mixing IDs from different models. TypeScript catches `function(userId: UserId)` called with `organizationId` at compile time. Eliminates an entire class of bugs

- ✅ **Automatic Transaction Merging** - Database client uses AsyncLocalStorage and Proxy pattern to auto-merge nested transactions. Call `db.txn()` anywhere and it merges into parent transaction if one exists, or creates new one if not. Eliminates manual transaction passing through call stacks. All mutations automatically wrapped in transactions via Prisma extension

- ✅ **Transaction-Aware Hooks** - Mutation lifecycle hooks (beforeCreate, afterUpdate, etc.) execute inside the transaction automatically via Prisma client extension. If transaction rolls back, hook side effects never happened. Hooks can access previous record state for updates/deletes. Extension wraps all mutations (create, update, delete, upsert) with automatic transaction + hook execution. Blocks unsafe operations (createMany, updateMany) that skip hooks

- ✅ **Post-Commit Callbacks** - `db.onCommit(fn)` registers callbacks that execute AFTER transaction commits successfully. Critical for webhooks, external API calls, and job enqueueing - ensures external systems only notified after database changes are permanent. Callbacks run with concurrency limits and performance tracking

[Learn more: HOOKS.md](docs/claude/HOOKS.md)

- ✅ **Post-Transaction Queue** - Jobs enqueued during transaction but only executed after successful commit. Ensures webhooks and external notifications don't fire for rolled-back changes. Critical for maintaining consistency between database state and external systems

- ✅ **Robust False Polymorphism** - Pattern for polymorphic relationships without database-level polymorphism. Models like Token (user/organization/space scoped) and CustomerRef (references different customer types) use explicit foreign keys with validation. More type-safe and performant than traditional polymorphic associations. [Learn more: DATABASE.md](docs/claude/DATABASE.md)

- ✅ **Split Schema Architecture** - One Prisma file per model in `packages/db/prisma/schema/` for better organization and merge conflict reduction. Schema files dynamically combined during generation. Makes large schemas manageable

- ✅ **Test Factory System** - `create*()` functions generate realistic test data with Faker integration. Auto-infers relationships (creating user automatically creates account if needed). Override only what matters for your test. Factories for 20/23 models (auth/log models — Account, Verification, AppEvent — excluded by design). [Learn more: TESTING.md](docs/claude/TESTING.md)

- ✅ **Database Utilities** - dump, restore, and clone operations for database management. Clone auto-truncates webhook subscriptions to prevent duplicate deliveries in copied environments

- ✅ **UUID v7 IDs** - Time-sortable UUIDs for chronological ordering without exposing creation timestamps. Better index performance than UUID v4

- ✅ **Request Scoping** - Database client scoped per-request for tracing and logging. All queries tagged with request ID for debugging

- ✅ **Transaction Isolation in Tests** - Each test runs in isolated transaction, rolled back after test completes. Ensures tests don't interfere with each other

- ✅ **23 Database Models** - user, account, session, verification, authProvider, organization, organizationUser, space, spaceUser, token, webhookSubscription, webhookEvent, inquiry, customerRef, cronJob, emailTemplate, emailComponent, auditLog, contact, appEvent, tag, tagAttachment, tagCategory

- ✅ **Zod Schema Generation** - Auto-generated Zod schemas from Prisma models for request/response validation with full type inference

- ✅ **Hydration System** - Automatically load nested relationships recursively with a single function call. Deduplicates requests to prevent N+1 queries. Use `hydrate(db, 'user', record)` to load all relations defined in schema - no manual includes needed

- ✅ **Pass-the-Delegate Pattern** - Type-safe query helpers with full type inference without generics. Write `query.findMany(db.user, { where })` and TypeScript infers `User[]` automatically. Eliminates need for `<User>` generic annotations throughout codebase

- ✅ **Runtime Schema Introspection** - Parse Prisma's runtime data model and inline schema to extract FK mappings, relations, and field metadata at runtime. Enables dynamic hydration, validation, and tooling without hardcoded model knowledge

- ✅ **Advanced Constraints** - Helper functions for PostgreSQL features Prisma doesn't support natively: partial unique indexes (`addUniqueWhereNotNull`), CHECK constraints (`addCheckConstraint`), and GIST indexes (`addGistIndex`) for advanced queries

- ✅ **False Polymorphism Registry** - Centralized configuration (`PolymorphismRegistry`) defining polymorphic patterns across models. Single source of truth for constraints, validation hooks, and FK resolution. Supports multi-axis polymorphism (Token owner + model, CustomerRef customer + provider)

- ✅ **Model Name Utilities** - Type-safe conversion between model names (`User`) and accessor names (`user`). Guards like `isModelName()` and `isAccessorName()` prevent runtime errors from invalid model references

[Learn more: DATABASE.md](docs/claude/DATABASE.md)

---

## Admin Operations

- ✅ **Cache Clearing** - `POST /admin/cache/clear` flushes Redis caches (permissions, tokens, sessions) without server restart. Essential for invalidating stale permission caches after role changes
- ✅ **Cron Job CRUD** - Full create/read/update/delete for scheduled jobs. Persist schedule, description, and enabled state. Admin can view all registered crons, their last/next run times, and current status
- ✅ **Manual Cron Triggering** - `POST /admin/cron/:name/trigger` runs any cron immediately regardless of schedule. Critical for one-off executions (key rotation, cache warming) without waiting for next scheduled run
- ✅ **Job Enqueueing** - `POST /admin/jobs/enqueue` manually enqueues any registered job with custom payload. Useful for reprocessing failed records or triggering background work on demand
- ✅ **Inquiry Oversight** - Admin routes to read and manage all inquiries across organizations. View status, override state transitions, inspect resolution metadata for support scenarios
- ✅ **Webhook Oversight** - Read all webhook subscriptions across organizations. Inspect delivery history via WebhookEvent records (status, response code, error body). Retrigger failed deliveries for integration debugging
- ✅ **BullBoard Dashboard** - Visual job monitoring at `/admin/queues`. Filterable by queue and status. Inspect job payloads, retry failed jobs, view execution times and error stack traces
- ✅ **Auth Provider Management** - Platform-level auth provider CRUD (Google, Microsoft, GitHub OAuth configs). Providers marked `platformDefault: true` are available to all organizations
- ✅ **Organization Management** - Read all organizations across platform with user counts, settings, and status. Superadmin routes bypass organization permission checks

---

## Background Jobs & Cron

**Redis-Backed Job Queue with Advanced Patterns** - BullMQ powers background job processing with three job constructor patterns for different concurrency needs: basic jobs, singleton jobs (one at a time), and superseding jobs (newer cancels older).

- ✅ **makeJob()** - Basic job constructor providing type-safe handler wrapper. Use for standard async operations (send email, process upload, generate report). Jobs run independently, multiple instances can execute concurrently

- ✅ **makeSingletonJob()** - Ensures only one instance runs at a time across all workers using Redis locks with heartbeat. Prevents duplicate execution of sensitive operations (database migrations, billing runs, encryption key rotation). Lock expires after 5 minutes with 2-minute heartbeat refresh

- ✅ **makeSupersedingJob()** - Allows newer jobs to cancel/supersede older jobs with same dedupeKey. Long-running jobs poll Redis every 500ms for supersession signal and abort gracefully. Perfect for search indexing, cache warming, or report generation where only latest matters

- ✅ **BullMQ Integration** - Redis-backed persistent queue with automatic retries (3 attempts, exponential backoff 5s base). Jobs survive server restarts. Separate queues for default, email, and webhook processing with independent concurrency limits

- ✅ **Cron Jobs** - Scheduled recurring tasks registered at startup. CronJob model persists schedule, last run, next run. Admin endpoints for manual triggering, enabling/disabling schedules

- ✅ **Job Handlers** - Type-safe handlers with full context (db, queue, logger). Current handlers: sendWebhook, cleanStaleWebhooks, rotateEncryptionKeys. Add new handlers by creating file in `handlers/` directory and exporting from index

- ✅ **BullBoard Dashboard** - Visual job monitoring at `/admin/queues`. View job status (active/waiting/delayed/failed), retry failed jobs, inspect payloads, see execution times. Filterable by queue and status

- ✅ **Graceful Shutdown** - Worker process closes BullMQ connection cleanly on SIGTERM/SIGINT. In-progress jobs finish before shutdown (with timeout). Prevents job corruption

- ✅ **Admin Routes** - Manual job enqueueing, cron trigger override, job status inspection, queue stats

---

## Webhooks

**Event-Driven Integration System** - Notify external systems when data changes. Organizations/spaces subscribe to events, receive RSA-SHA256-signed payloads. Automatic retries, delivery tracking, and async processing via job queue.

- ✅ **Webhook Subscriptions** - Organizations and spaces can subscribe to events (user.created, organization.updated, etc.). Each subscription has URL, events list, and active/inactive status. Payloads are signed with a server-held RSA private key (asymmetric); receivers verify with the published public key. False polymorphism pattern allows User/Organization/Space ownership

- ✅ **Event-Based Triggers** - Database hooks automatically fire webhook deliveries after successful mutations. Hook system ensures webhooks only sent after transaction commits. Events follow pattern: `{resource}.{action}` (user.created, token.deleted)

- ✅ **RSA Signature Verification** - Each webhook includes `x-webhook-signature` header with an RSA-SHA256 signature (base64). Signed with a server-held private key; receivers verify with the public key exposed at `/webhookSubscription/info`. Asymmetric — no shared secret to leak. Signed body includes a unix `timestamp` so receivers can reject replays. Prevents webhook spoofing and tampering

- ✅ **Async Delivery via Jobs** - Webhooks enqueued as BullMQ jobs (separate webhook queue). Never blocks request processing. Failed deliveries retry automatically (3 attempts, exponential backoff). Webhook jobs run outside transaction to avoid timeouts

- ✅ **Delivery Tracking** - WebhookEvent model records every delivery attempt with status (pending, sent, failed), response code, response body, error message. Superadmins can inspect delivery history and debug integration issues

- ✅ **Automatic Cleanup** - Cron job removes old webhook events (90+ days) to prevent unbounded table growth. Configurable retention period

- ✅ **Superadmin Oversight** - Superadmin routes for viewing all subscriptions across organizations, inspecting delivery failures, manually retriggering failed deliveries

---

## Real-Time Communication

**Production-Ready WebSocket Infrastructure** - Full bidirectional real-time communication with Redis pub/sub for multi-server support. Clients can subscribe to channels, receive instant updates, and maintain persistent connections with automatic reconnection and keepalive.

- ✅ **WebSocket Server** - Native Bun WebSocket support with connection lifecycle management (open, message, close, drain). Integrates with Hono server - same HTTP port handles both REST and WebSocket upgrades. Token-based authentication via query param (`?token=`) since WebSocket handshake can't set custom headers from browser

- ✅ **Connection Management** - Track connections by ID, user, and channel subscriptions. Multiple connections per user supported (tabs, devices). Automatic cleanup of stale connections (5min without ping). `getConnectionStats()` provides visibility into active connections, unique users, and channel subscribers

- ✅ **Channel Subscriptions** - Clients subscribe to arbitrary channels (`org:abc123`, `space:xyz`, `user:123`). Server maintains subscription registry and routes messages only to subscribed connections. Subscribe/unsubscribe via client messages. Channels enable granular broadcasting without sending to all users

- ✅ **Redis Pub/Sub for Multi-Server** - Horizontal scaling support via Redis publish/subscribe. `sendToUser()`, `sendToChannel()`, `broadcast()` functions publish to Redis, which fans out to all server instances. Each server subscribes to Redis and forwards messages to its local WebSocket connections. Enables load-balanced WebSocket servers

- ✅ **Graceful Shutdown** - `drainConnections()` sends reconnect message to all clients before server shutdown. Clients can implement automatic reconnection logic. Ensures zero message loss during deployments

- ✅ **Keepalive & Heartbeat** - Client sends ping messages, server responds with pong and updates last ping timestamp. Connections without ping for 5+ minutes automatically closed and cleaned up. Prevents resource leaks from abandoned connections

- ✅ **Event Broadcasting Pattern** - App events broadcast over WebSocket via the `websocket` bridge in `makeAppEvent` — a handler's `websocket(data)` selector returns refresh triggers (`{category:'query', action:'refetch', key}`) that publish to channels via `sendToChannel`. Live (e.g. `inquiryResolved`) and consumed by the frontend's `addLiveQuery` → TanStack Query invalidation. (Channel subscription is not yet permission-gated — see INFRA-004 security gap)

- ✅ **App Events System** - `emitAppEvent('event.name', data)` for business events; actor context auto-enriches from `auditActorContext` (AsyncLocalStorage). Handlers defined via `makeAppEvent` fan out across bridges in parallel (`Promise.allSettled`): **observe** (BullMQ job → AppEvent audit table), **email** (typed handoffs → sendEmail jobs with declarative targeting), **websocket** (Redis pub/sub channel broadcasts), and **direct callbacks**. Centralized handler map at `apps/api/src/appEvents/handlers/index.ts` mirrors the BullMQ job-handler pattern. Events inside `db.txn()` defer to `onCommit`; events outside fire immediately

- 🟣 **Feature Flags** - Runtime feature toggles not implemented. Would enable gradual rollouts, A/B testing, and emergency kill switches. Could integrate with external services (LaunchDarkly, Unleash) or build internal Redis-backed solution

[Learn more: APP_EVENTS.md](docs/claude/APP_EVENTS.md)

---

## Email System

**Database-Driven Email Templates with Multi-Tenancy** - MJML-based email system with reusable components, variable substitution, and polymorphic ownership. Organizations can customize templates with their branding. Send pipeline is operational end to end (Resend adapter + BullMQ job); remaining work is standard-template authoring, delivery tracking, preferences, and an admin authoring UI (see ticket COMM-001).

- ✅ **EmailTemplate Schema** - Database model for email templates using MJML (responsive email markup). Templates have slug (otp, welcome), locale (en, es), subject with variables (`{{code}}`), and full MJML body with `{{component:slug}}` references and `{{variable.*}}` placeholders. Category (system/promotional) controls unsubscribe requirements

- ✅ **EmailComponent Schema** - Reusable MJML components (headers, footers, buttons) referenced by templates via `{{component:default-header}}`. Components can nest other components. Pre-computed `componentRefs` array tracks dependencies for resolution

- ✅ **Polymorphic Ownership** - False polymorphism pattern enables templates at four levels: **default** (platform-wide, all tenants), **admin** (platform internal only), **Organization** (tenant-branded), **Space** (space-specific overrides). Orgs can customize templates while inheriting platform defaults. `inheritToSpaces` flag controls whether org templates cascade to spaces

- ✅ **Locale Support** - Multi-language templates via locale field. Unique constraint on (slug, locale, owner) allows same template in multiple languages. Template lookup resolves to user's locale or falls back to `en`

- ✅ **Communication Categories** - System emails (OTP, password reset, security) cannot be unsubscribed. Promotional emails (newsletters, marketing) include unsubscribe link. Category enforced at send time

- ✅ **Email Clients** - Resend client (production) and Console client (dev/test) implemented in `packages/email`. Clients provide unified interface for sending with from/to/subject/html. No Postmark or SendGrid clients

- ✅ **Template Rendering Pipeline** - Complete MJML rendering system in `packages/email/src/render/`: `compose()` fetches templates and recursively expands `{{component:slug}}` refs, `interpolate()` substitutes `{{variable.*}}` placeholders, `expand()` handles nested components, `lookupCascade()` resolves templates with owner fallbacks (Space → Org → default). MJML validation included. Actively used by the `sendEmail` job (compose → interpolate → mjml2html → send); the remaining gap is an admin authoring endpoint/UI, not the render path

- 🟡 **Common Flow Templates** - No templates created yet for standard flows (welcome email, password reset, email verification, invitation). Each needs MJML authoring and variable schema definition

- ✅ **Job Queue Integration** - Email sending enqueues as BullMQ background jobs via the app-event email bridge → `sendEmail` handler (`apps/api/src/jobs/handlers/sendEmail.ts`). Non-blocking, retried; nothing synchronous hits the provider in the request path

- 🟣 **Email System Completion** (ticket COMM-001, depends on INFRA-002) - Wire up template rendering, configure providers, author standard templates, integrate with job queue, add admin UI for template management

[Learn more: COMMUNICATIONS.md](docs/claude/COMMUNICATIONS.md)

---

## Encryption & Security

### Field-Level Encryption Engine

- ✅ **AES-256-GCM** - Industry-standard authenticated encryption. Each field encrypted independently with a random IV. Authentication tag detects tampering. Per-field version tracking enables targeted key rotation
- ✅ **Registry Pattern** - `ENCRYPTED_MODELS` config declares which model fields are encrypted. Adding a field to the registry is the only step required — hooks, rotation, and validation all auto-discover it
- ✅ **Auto-Discovery Rotation** - `rotateEncryptionKeys` job queries the registry, finds all encrypted models/fields, and re-encrypts any record with a stale key version. One job handles the entire system
- ✅ **Type-Safe Generics** - `encryptField<Model, Key>()` / `decryptField()` enforce that field name is a valid encrypted field for the given model. Typos caught at compile time
- ✅ **AAD (Additional Authenticated Data)** - Ciphertext cryptographically bound to immutable record fields (e.g. record ID). Prevents ciphertext from being transplanted to another record
- ✅ **Idempotent Rotation** - Rotation uses `WHERE version = N` precondition. Safe to run multiple times — only records with the old version get re-encrypted. No double-encryption
- ✅ **Singleton Job Locking** - Redis lock with heartbeat prevents concurrent rotation runs across workers. Lock expires after 5 minutes; heartbeat refreshes every 2 minutes
- ✅ **CI Version Validation** - Pre-deploy check blocks if key version has gaps, downgrades, or mixed versions across environments. Catches misconfiguration before it reaches production
- ✅ **Dual-Key Zero-Downtime Rotation** - During rotation window, both current and previous key versions accepted for decryption. No request fails mid-rotation. Old-version records re-encrypted in background
- ✅ **3 Env Vars Per Keyring** - `ENCRYPTION_KEY_CURRENT`, `ENCRYPTION_KEY_PREVIOUS`, `ENCRYPTION_KEY_VERSION`. Simple, auditable. Rotation = swap current→previous, set new current, bump version
- ✅ **BullBoard Monitoring** - Rotation jobs visible in BullBoard dashboard. Track progress, execution time, failure reasons
- ✅ **Full Test Suite** - Coverage for encryption service, helpers, CI validation logic, and environment variable parsing
- ✅ **AuthProvider Secrets Encrypted** - OAuth client secrets encrypted at rest using the field encryption engine. First production use of the system
- 🟣 **Key Escrow & Lifecycle** (ticket FEAT-013) - Key backup, recovery procedures, admin visibility into key ages and rotation history
- 🟣 **Encryption Admin Dashboard** (ticket FEAT-013) - UI for monitoring encrypted field coverage, rotation status, and key health across all models

### General Security

- ✅ **HTTP-Only Cookie (email/password)** - Email/password auth issues a stateless JWT in an HTTP-only, Secure, SameSite=Lax cookie. Not accessible from JavaScript. CSRF protection via BetterAuth double-submit cookie pattern
- ✅ **Bearer Token (OAuth)** - OAuth flow stores the JWT in localStorage and sends it as `Authorization: Bearer <token>`. No cookie — CSRF is not a risk for Bearer tokens, but XSS is (localStorage is JS-accessible). Trade-off accepted for OAuth compatibility
- ✅ **SQL Injection Prevention** - Prisma uses parameterized queries exclusively. No string interpolation in queries. Raw SQL escape hatches disabled by convention
- ✅ **XSS Prevention** - React escapes all interpolated values by default. No `dangerouslySetInnerHTML` usage. Content Security Policy headers configurable via Hono middleware
- ✅ **Password Hashing** - bcrypt via BetterAuth with configurable cost factor. Passwords never stored or logged in plaintext
- ✅ **Token Hashing** - API tokens stored as SHA-256 hashes. Raw token shown once at creation, never retrievable. Token comparison done on hash
- 🟣 **Rate Limiting** - Redis infrastructure in place for sliding window rate limits. Implementation pending (ticket INFRA-002 dependency)
- ✅ **Audit Logs** - `AuditLog` model with full actor context (user, spoof user, token, job, inquiry). Automatic hook captures create/update/delete for 10 enabled models. Soft-delete detection, empty-diff guard, sensitive field redaction, and inquiry lineage via `sourceInquiryId`. Retention job and admin API shipped (FEAT-005 Complete); explorer UI deferred to FEAT-017

---

## User Management

- ✅ **User CRUD** - Create, read, update, delete users. Admin routes for platform-level user management; me routes for self-service operations. Typed IDs prevent accidental cross-model ID mixing
- ✅ **Me Endpoint System** - Self-service API with 8+ endpoints under `/me`: read profile, update name, change password, list orgs, list spaces, list tokens, manage auth providers, delete account. Authenticated users manage their own data without needing admin access
- ✅ **Email Verification** - BetterAuth verification flow: send verification email with signed token, verify token on click, mark email as verified. Verification model persists tokens with expiry
- ✅ **Password Reset** - BetterAuth reset flow: request reset email, validate signed token, set new password. Tokens are single-use and expire after 1 hour
- ✅ **User Redaction / GDPR** - Anonymize user PII on account deletion: email → `redacted-{uuid}@redacted.invalid`, name → `Redacted User`, avatar cleared. Preserves record for referential integrity while removing identifying data
- ✅ **User-Scoped Tokens** - Users create personal access tokens for API automation. Tokens inherit user's permissions across all their organizations. Optional expiry, usage tracking via `lastUsedAt`
- 🟡 **Profile Editing** - Profile page renders name and org slug. Editing not yet wired to API mutations; save handler is a placeholder
- 🟡 **User Settings** - Settings pages (notifications, preferences, appearance) exist as route shells; content not yet implemented

---

## Inquiry System

**Standardized Request/Approval/Audit Primitive** - Instead of building ad-hoc handlers for every common org action (invite user, create space, transfer ownership, request access), the Inquiry system provides a unified pattern: create a request, route it for approval, execute the resolution, and log the interaction. Every team reinvents this — having it as a first-class primitive means consistent behavior, audit trails, and extensibility across all org workflows.

- ✅ **Core API** - Full CRUD with state machine (draft → sent → changesRequested → approved/denied/canceled). Resource context middleware loads inquiry with all includes — singleton reads and mutations are single DB round-trips
- ✅ **Resolution Actions** - Approved inquiries execute handler side effects (org membership, space creation, space transfer). Resolution runs in transaction; actor context set before mutations for audit lineage
- ✅ **Polymorphic Ownership** - False polymorphism pattern. Source and target each support User, Organization, Space, or admin. Validated by falsePolymorphism hook
- ✅ **Status Tracking** - Full state machine. `sentAt` set once on first send (historical). `expiresAt` set on send via `computeExpiresAt(type)`, cleared when moved back to draft
- ✅ **Audit Lineage** - `sourceInquiryId` set in actor context during resolution so all side-effect mutations link back to the causal inquiry
- 🟡 **UI and flow completion** (ticket FEAT-001) - Invitation flow, approval UI, and onboarding integrations in progress

---

## Contact System

**Unified contact-info entries (phone, email, social handles, …) for any owner.** One model, one set of routes, one validation pipeline — instead of bespoke columns scattered across User/Organization/Space and a different shape per channel. New contact types are added by registering a per-type def, not by changing the schema.

- ✅ **Single Contact Model** - One `Contact` table covers phone, email, website, and 19 social/messaging handles (linkedin, github, twitter, whatsapp, telegram, discord, instagram, facebook, youtube, tiktok, bluesky, threads, reddit, signal, mastodon, line, wechat, viber, skype). False-polymorphic owner: `ownerModel` discriminator + nullable `userId`/`organizationId`/`spaceId`. Per-`(owner, type)` uniqueness on `valueKey` is enforced by three partial `@@unique([<fk>, type, valueKey], where: { <fk>: { not: null } })` — one per owner FK. Same `valueKey` is allowed across different types for one owner (a user can have the same handle for github and twitter); blocked only as a duplicate within the same `(owner, type)`. Partials are required because Postgres treats NULLs as distinct in a composite unique, so a single composite over the polymorphic FKs would let `(User, 'u1', null, null, …)` duplicate. Each partial doubles as a lookup index for that owner.

- ✅ **Per-Type Registry** - `ContactRegistry` in `@template/shared/contact` maps each type to a `ContactTypeDef`: a loose `inputSchema` (accepts pasted URLs, structured input, etc.), a `parseInput` normalizer, a strict `valueSchema` for storage, a `toValueKey` projection (E.164 for phones, jid for whatsapp, `${classifier}:${handle}` for handles), an optional `toUrl` for display, and `subtype` rules (`forbidden`/`optional`/`required`). Adding a new contact type = drop a def file in `defs/`, register it, done — no schema change, no controller change

- ✅ **`contactRules` Hook** - Single before-mutation hook validates and normalizes every Contact write across `create`, `createManyAndReturn`, `upsert`, `update`, `updateManyAndReturn`. Looks up the type def, runs subtype rules, parses + canonicalizes `value`, computes `valueKey`. Update paths shadow-merge with `previous` so partial updates validate against the merged record. `position` ordering is handled by the separate `orderedList` hook (below)

- ✅ **Ordered List Hook** - Generic hook system in `apps/api/src/hooks/orderedList/` that auto-manages dense `[1..N]` position columns for any registered model + scope combination. Registry-driven (`packages/db/src/registries/orderedList.ts` maps `model → { field: scopeFields[] }`); covers `create`, `createManyAndReturn`, `update`, `updateManyAndReturn` (deletedAt only — bulk position writes throw), `upsert`, `delete`, `deleteMany`. Soft-deleted rows get distinct negative positions; restoring appends to the live tail. Bulk paths are O(scopes) — single CTE `UPDATE … FROM (VALUES …)` per scope, not per row. The registry composes into `HOOK_IGNORE_FIELDS` so audit/webhooks/generic-noop detection treat ordering-only updates as noise; cascade helpers use `UPDATE … RETURNING *` and the hook queues per-row cache invalidation on commit. Core algorithm in `apps/api/src/lib/prisma/orderedList.ts`

- ✅ **Row-Level Permission Overrides** - Optional `permissionRules: Json?` column lets owners share individual rows (e.g. "make this email readable by anyone"). Stored as `Record<Action, ActionRule>`; `check()` OR's the row rule with the schema rule for that action (additive only — row rules can grant, never restrict). Boundary validation via `buildPermissionRulesSchema(model, pick?)` derives valid action keys from the rebac schema; routes typically only expose `read` for sharing, keeping write actions owner-only

- ✅ **`ownerActions()` Helper** - Spreadable rebac action block for owner-polymorphic models. Each of `own`/`manage`/`operate`/`read` fans out across the configured owner relations (default: user/organization/space) — only the populated FK resolves, the others' rel returns false. `contact: { actions: ownerActions() }` is the entire schema entry

- ✅ **Endpoints** - `GET /contact/:id`, `PATCH /contact/:id`, `DELETE /contact/:id`, `GET /admin/contacts`, plus owner-scoped create/list under `POST/GET /me/contacts`, `POST/GET /organization/:id/contacts`, `POST/GET /space/:id/contacts`. Owner FKs are stripped from request bodies via `sanitizeKeys` and re-injected from auth context — clients can't transfer rows across owners

- ✅ **Test Coverage** - `contactCrud.test.ts` covers per-type input normalization, per-owner uniqueness (two users can claim the same handle), `permissionRules` granting cross-user read while writes stay owner-gated, and rejection of permissionRules for non-overridable actions. `contactRules` hook has its own `hook.test.ts` for validation. The orderedList hook is exercised by 45 tests split across `hooks/orderedList/tests/{create,delete,restore,update,invariants}.test.ts` covering single + bulk, soft-delete / restore / hard-delete, multi-scope isolation, density invariants, and the bulk-position-write throw

[Learn more: DATABASE.md](docs/claude/DATABASE.md) | [HOOKS.md](docs/claude/HOOKS.md) | [PERMISSIONS.md](docs/claude/PERMISSIONS.md#row-level-overrides)

---

## Customer Management

- 🟡 Customer model schema exists, not integrated into API/UI
- 🟡 Customer reference support (polymorphic false polymorphism pattern)

---

## Frontend Apps

**Route shells exist across all three apps, most pages are placeholders under active development.**

- ✅ **App scaffolding** - All three apps (web, admin, superadmin) have routing, auth, layouts, and navigation wired up
- ✅ **Auth flows** - Login, signup, OAuth callback fully functional across all apps
- 🟡 **Web App** (`apps/web/`) - Dashboard, organizations, communications, users, settings pages exist as placeholders
- 🟡 **Admin App** (`apps/admin/`) - Dashboard, organizations, communications, users, settings pages exist as placeholders
- 🟡 **Superadmin App** (`apps/superadmin/`) - Dashboard, communications, users, settings pages exist as placeholders

---

## Frontend Architecture

**Modern React Stack with Type Safety** - React 19 + TypeScript 5.9, TanStack Router v1 for file-based routing, TanStack Query v5 for server state, Zustand for client state. Vite 7 for lightning-fast builds, Tailwind CSS 4 for styling.

- ✅ React 19 + TypeScript 5.9
- ✅ **File-Based Routing** - TanStack Router scans `app/routes/` directory and generates type-safe route tree. Routes colocated with page components. Nested layouts via `__root.tsx` and `_authenticated.tsx`. Automatic code splitting per route for optimal bundle sizes

- ✅ **Declarative Navigation System** - Navigation config files organized by context (user/org/space/public) and feature (dashboard/settings/communications). Each nav item declares path, label, icon, and required permissions. Menu items automatically filtered based on user permissions and current context. Config reusable across web/admin/superadmin apps with context-specific overrides

- ✅ **Context-Aware Routing** - Routes automatically include current context params (`?org=`, `?space=`). Navigate to organization settings and URL becomes `/settings?org=orgId`. Switch organizations and all links update automatically. `getContextParams()` generates params for any route based on current state

- ✅ **Zustand State Management** - Six slices manage different concerns: **auth** (user/session), **tenant** (org/space), **permissions** (RBAC/ReBAC cache), **navigation** (breadcrumbs/menu state), **ui** (theme/modals/toasts), **client** (API base URL/headers). Slice factories enable testing without circular dependencies

- ✅ **Server State Caching** - TanStack Query v5 handles API response caching with smart invalidation. Auto-refetch on window focus, configurable stale times, request deduplication. Optimistic updates with automatic rollback on error maintain UI consistency

- ✅ **API Client Wrappers** - `apiQuery()` for GET requests unwraps nested `data.data` for clean usage. `apiMutation()` for mutations returns full response enabling optimistic update patterns. Both handle auth headers (session/token) and spoof headers (`x-spoof-user-email`) automatically

- ✅ **Route Guards** - `requireAuth()` redirects unauthenticated users to `/login?redirectTo=currentPath`. `requirePublic()` redirects authenticated users away from login/signup. Guards preserve context params across redirects. Execute in route `beforeLoad` for instant feedback before component renders

- ✅ **Vite Build System** - Lightning-fast HMR during development, optimized production builds with tree-shaking and code splitting. Supports workspace dependency hot reload via Turborepo watch mode

---

## UI Components

**Primitives complete, higher-level components under construction.** Built on Shadcn UI with Tailwind CSS 4.

### Done (Primitives)

- ✅ **Core Primitives** - Avatar, Badge, Breadcrumb, Button, Card, DropdownMenu, EmptyState, Input, Label, Pagination, PasswordInput, Select, SlugInput, Table, ThemeToggle

- ✅ **AppShell** - Main application layout with sidebar, header, and breadcrumb navigation. Wires to Zustand store for current user, org, space

- ✅ **Sidebar** - Collapsible navigation menu with permission-based item filtering, active state, and route highlighting

- ✅ **UserMenu** - Profile dropdown with avatar, name, email, logout, and spoof badge for impersonation

- ✅ **ContextSelector** - Dropdown for switching organizations and spaces, updates URL params and global state

- ✅ **Table + Pagination** - Table primitive with fixed-page pagination (page numbers, per-page selector, record count) and infinite scroll (IntersectionObserver sentinel). Supports viewport scroll with sticky headers and window scroll. All items rendered in DOM (no virtualization) so text selection, Ctrl+F, and copy-paste work.

- ✅ **Data Hooks** - `usePaginatedData` and `useInfiniteData` manage search, filter, sort, and pagination state. `makeDataConfig` auto-generates configuration from the OpenAPI spec (searchable fields, orderable fields, enum filters). Scroll position persisted in `history.state` for back/forward restoration. Optional shareable URL sync (`?page=3&search=acme`).

- ✅ **Section Hash Navigation** - `useSectionHash` auto-discovers `data-section` elements via MutationObserver, syncs URL hash to most visible section. Dot-notation deep linking (`#usersTable.usr_abc123`) scrolls to specific rows.

### In Progress

- 🟡 **Form Components** - React Hook Form + Zod integration partially done; full component set (checkbox, radio, switch, date picker) still being built out

- 🟡 **Page-level components** - Higher-level composed pages (OrganizationsPage, UsersPage, etc.) under active development

- 🟣 Visual JSON editor (ticket DEV-002)

---

## Frontend Hooks

**20+ Custom Hooks for Common Patterns** - Reusable logic extracted into hooks for consistency across apps. All hooks are type-safe, tested, and follow React best practices.

- ✅ **useAuthenticatedRouting()** - Initializes authentication state, syncs URL params (`?org=`, `?space=`) with store, handles redirects for auth/public routes. Call once in root component - sets up entire auth flow

- ✅ **useOptimisticMutation()** - Wrapper around TanStack Query mutations with optimistic updates for list operations. Instantly updates UI on create/update/delete, automatically rolls back on error. Prevents loading states for better UX

- ✅ **useValidateUniqueness()** - Real-time uniqueness validation for form fields (email, username, slug). Debounces input, calls API to check uniqueness, returns validation error. Integrates with React Hook Form

- ✅ **useEventRefetch()** - Subscribes to custom events and refetches TanStack Query queries when events fire. Use for cross-component data invalidation (user created in modal, refetch user list in table)

- ✅ **useBreadcrumbs()** - Generates breadcrumb trail from current route using navigation config. Returns array of `{ label, path }` objects for rendering breadcrumb navigation

- ✅ **useAuthStrategy()** - Detects and configures multi-provider authentication (email/password, OAuth, SAML). Returns available providers, handles provider selection, manages auth flow

- ✅ **usePermission()** - Checks if current user has specific permission in current context. Returns boolean for conditional rendering. Reacts to context switches (org/space changes)

- ✅ **useDebounce()** - Debounces rapidly changing values (search input, filter selections). Prevents excessive API calls. Configurable delay, cancels pending updates on unmount

- ✅ **useMediaQuery()** - Responsive design helper that returns boolean for media query matches. Use for conditional rendering based on screen size. Server-safe (returns false during SSR)

- ✅ **useAuthProviders()** - Fetches available auth providers for current org or platform. Used by login/signup to render correct OAuth buttons, show SSO option, or show password field based on configured providers
- ✅ **useAppEvents()** - Subscribes to named DOM custom events for cross-component communication. Pair with `useEventRefetch()` to trigger query invalidations without prop drilling or shared state
- ✅ **useDarkMode()** - Reads and sets theme preference (light/dark/system). Syncs with Zustand ui slice, persists across sessions, applies Tailwind `dark:` class to document root. Returns `{ theme, setTheme, isDark }`
- ✅ **useLanguage()** - Returns current locale string and setter. Backed by Zustand ui slice. Ready for i18n integration — currently returns `en` as default, locale-aware components read from this hook
- ✅ **usePageMeta()** - Sets `document.title` and meta description for the current route. Accepts raw strings or template with app name. Called in page components to keep browser tab titles contextual
- 🟡 **useSpaceTheme()** - Hook exists but returns mock values; space theming not yet wired to real data

---

## Developer Experience

**Fast Iteration with Strong Guardrails** - Lightning-fast hot reload across monorepo, comprehensive test suite with factories, automatic code generation, strict type checking, and custom lint rules. Everything optimized for velocity without sacrificing quality.

### Development Workflow

- ✅ **Turborepo Watch Mode** - Hot reload across workspace dependencies. Change shared package code and all consuming apps reload instantly. No manual rebuilds. `turbo watch local` runs all apps, `turbo watch local#api` filters to specific package. Task caching skips unchanged work

- ✅ **Bun Hot Reload** - Native `--hot` flag reloads API/worker on file changes in <100ms. Vite HMR for frontends preserves React state across edits. Development iteration loop measured in milliseconds, not seconds

- ✅ **Path Aliases** - Clean imports with `#/` (internal) and `@template/*` (cross-package). No `../../../` relative imports. TypeScript and build tools resolve aliases automatically. Custom lint check enforces usage

### Testing & Quality

- ✅ **93 Test Files with Bun Test Runner** - Unit and integration tests, backend focused. Fast execution with watch mode for TDD workflow. Frontend app tests minimal (web/admin/superadmin apps have near-zero coverage)

- ✅ **Test Factories with Faker** - `create*()` and `build*()` functions generate realistic test data. `create*()` persists to DB, `build*()` is in-memory only. Auto-infers relationships (creating user auto-creates account). Override only what matters for your test. Entities expose `__serialize()` for API/UI-shaped assertions (converts `Date` fields to ISO strings). Factories for 20/23 models (auth/log models excluded by design). Tests run against a dedicated test database

- ✅ **Mock Webhook Receiver** - Test module mounts a `POST /test/webhook` endpoint in test environment only. Stores received webhook payloads in-memory (`receivedWebhooks[]`) so tests can assert on delivery, headers, and HMAC signatures. `clearReceivedWebhooks()` resets between tests. Enables real end-to-end webhook delivery tests without external services

- ✅ **Automatic Test Cleanup** - Database hooks track which tables were touched during tests. `cleanupTouchedTables()` utility truncates only modified tables after test suite completes. Temporarily disables FK constraints, uses TRUNCATE CASCADE for efficiency. Prevents test data buildup without manual cleanup

- ✅ **React Testing Library** - Component tests follow best practices (test behavior, not implementation). User-centric queries (getByRole, getByLabelText). Async utilities for loading states

### Type Safety & Code Generation

- ✅ **TypeScript Strict Mode** - Strictest compiler settings across all packages. `any` avoided in application code (rare casts only at framework/type boundaries), null checks enforced, proper error handling required. Catches bugs at compile time, not runtime

- ✅ **OpenAPI SDK Auto-Generation** - Type-safe client SDK generated from route definitions. Every endpoint becomes typed function with request/response inference. Changes to API automatically flow to frontend types. Run `generate:sdk` after route changes

- ✅ **Prisma + Zod Generation** - Prisma client and Zod schemas auto-generated from schema. Input schemas for validation, model schemas for responses. Run `db:generate` after schema changes. Never manually write validation schemas

- ✅ **Route Tree Generation** - TanStack Router scans route files and generates type-safe routing tree. Navigation autocompletes paths, params strongly typed. Run `generate:routes` after adding routes

### Linting & Formatting

- ✅ **Biome** - Fast linting and formatting (10x faster than ESLint+Prettier). Consistent code style across monorepo. Auto-fix on save. `bun run lint` checks all packages

- ✅ **Custom Lint Checks** - Three custom validators run after Biome: `check-import-aliases.sh` (enforces `#/` imports), `check-generated-files.sh` (ensures Prisma/OpenAPI SDK up to date), `run-post-biome-checks.sh` (orchestrates all checks). Prevents common mistakes

- ✅ **Custom CI Rules** - `scripts/ci/run-ci-rules.sh` executes alphabetical rules in `scripts/ci/rules`: `no-jest.sh` (blocks Jest deps/imports/globals), `no-vitest.sh` (blocks Vitest deps/imports), and `ui-serialized-factories.sh` (requires `__serialize()` and forbids `__serialize() as any` in UI tests). `--test` runs rule self-tests against `scripts/ci/rule-violations/*` pass/fail fixtures

- ✅ **Optional Pre-commit Hooks** - Git hooks available for local validation before commit. Not enforced (developer choice) but recommended. Runs lint + type check on staged files

### Boilerplate Reduction

- ✅ **makeController() Factory** - Generates type-safe responders from route definition. Eliminates manual response construction and validation. One factory replaces 20+ lines per endpoint

- ✅ **makeError() Factory** - Standardized error creation with guidance text. No more manual HTTPException construction. Consistent error shapes across API

- ✅ **Route Templates** - Pre-built patterns (readRoute, createRoute, updateRoute) reduce API definition from ~100 lines to ~20 lines. Enforces consistency while eliminating boilerplate

- ✅ **Data Config Builder** - `makeDataConfig(operationId)` reads the OpenAPI spec and auto-generates searchable fields, orderable fields, and enum filters. One line of config per table/list view. `usePaginatedData` and `useInfiniteData` consume the config and produce query objects, pagination props, and scroll restoration

- ✅ **Route Guards** - Reusable auth/permission checks with automatic redirects and context preservation. Drop `beforeLoad: requireAuth()` in route definition - done

[Learn more: TESTING.md](docs/claude/TESTING.md) | [DEVELOPER.md](docs/claude/DEVELOPER.md)

---

## Infrastructure & DevOps

**Production-Grade Operations Toolkit** - Complete observability with structured logging, optional distributed tracing, error tracking, and Redis-backed caching. Environment management via Infisical, containerized local development with Docker Compose, and comprehensive database utilities for backups and cloning.

### Logging & Observability

- ✅ **Structured Logging with Consola** - Custom logger wrapper providing automatic timestamp prefixes, log scopes via AsyncLocalStorage (backend) or static scopes (frontend), and environment-aware formatting (colors in local/test, compact in production). Configurable log levels (silent/error/warn/info/debug/trace) via `LOG_LEVEL` env var. [Learn more: LOGGING.md](docs/claude/LOGGING.md)

- ✅ **Log Scopes** - Tag logs with execution context for filtering and debugging. 12 predefined scopes: api, db, worker, seed, ws, test, auth, cache, hook, job, email, plus custom scopes. Scopes automatically nest and propagate through async call stacks via AsyncLocalStorage. Manual scope override via last argument: `log.info('msg', LogScope.db)`

- ✅ **Request ID Correlation** - Every API request gets unique ID that flows through all logs, DB queries, and error traces. Enables debugging by following single request through entire system. ID generated in middleware and scoped via AsyncLocalStorage

- ✅ **OpenTelemetry Integration** - OTLP-compatible distributed tracing and metrics ready to use. Auto-instruments HTTP requests (excluding `/health`) and Prisma queries when `OTEL_EXPORTER_OTLP_ENDPOINT` configured. Sends to any OTLP backend (BetterStack, Datadog, Honeycomb, etc.). Skipped in local/test to avoid performance overhead. Dynamic imports ensure zero cost when disabled

- ✅ **Error Reporter Adapter** - `errorReporter` singleton via adapter pattern (`makeAdapterRouter`). Sentry adapter used in prod/staging/pr when `SENTRY_ENABLED=true` and `SENTRY_DSN` set; console adapter used everywhere else. Error middleware routes all 5xx exceptions through the adapter — swapping providers requires no application code changes (ticket INFRA-009)

### Environment & Secrets

- ✅ **Infisical Secrets Management** - Centralized secret storage. Three environments: pr (ephemeral preview), staging, prod. Secrets injected at runtime via `with-env.sh` wrapper script - no env files committed to repo. CLI installed via init script

- ✅ **Environment Composition** - `with-env.sh` script composes environment and runs commands: `bun run with prod api turbo watch local#api`. Enables running local code against production secrets for debugging. Supports per-app environments (api, web, admin, superadmin)

- ✅ **Smart Env File Sync** - `sync-env.sh` intelligently manages local environment files. Creates `.env.local`/`.env.test` from examples if missing. More importantly, adds missing keys to existing env files when example is updated - automatically appends new variables without overwriting existing values. Prevents "missing environment variable" errors when pulling latest code

- ✅ **Three Deployment Environments** - pr (ephemeral, auto-created per PR), staging (pre-production validation), prod (production). Each has isolated Infisical project and database. PR environments auto-cleaned after merge

### Caching & Performance

- ✅ **Redis with IORedis** - Distributed caching layer (Redis 7 alpine). Singleton connections with automatic reconnection, error handling, and connection pooling. Mock Redis in tests for isolation

- ✅ **Redis Use Cases** - Session cache (5min cookieCache TTL), permission evaluation cache (10min), token hash cache (10min), BullMQ job queue persistence, WebSocket pub/sub for multi-server broadcasting

- ✅ **Namespace Support** - Redis keys auto-prefixed by use case (session:, perm:, token:, job:) preventing collisions and enabling selective cache clearing

- ✅ **Multiple Redis Connections** - Main client (general operations), dedicated subscriber (pub/sub is blocking), separate BullMQ connections per queue/worker. Prevents blocking operations from interfering

### Database Operations

- ✅ **Docker Compose for Supporting Services** - Containerized PostgreSQL 18 (alpine) and Redis 7 (alpine) for local development. One command setup: `docker compose up`. Persistent volumes for data, health checks, automatic restarts. Bun servers (API, worker, frontends) run natively via Turborepo watch mode, not in containers

- ✅ **Database Utilities** - `db:dump` (pg_dump to file), `db:restore` (restore from dump), `db:clone` (duplicate database with new name). Clone auto-truncates webhook subscriptions to prevent duplicate deliveries to external systems in copied environments

- ✅ **Migration Safety** - Prisma migrations version-controlled. Push schema changes with `db:push` (dev), generate migrations with `db:migrate` (prod). Auto-generates Prisma client and Zod schemas after schema changes

### Coming Soon

- 🟡 **Adapter Primitives** (ticket INFRA-009) - `makeAdapterRouter` + `makeAdapterRegistry` in `@template/shared/adapter` are the base primitive. Error reporter adapter shipped. Logger adapter (consola/pino), file storage (S3/local), and payments (Stripe/Square) pending

- 🟣 **Product Analytics** (ticket INFRA-010) - User behavior tracking for product decisions. Evaluating OpenPanel, Mixpanel, or internal solution. Track page views, feature usage, funnels, retention

- 🟣 **CI/CD Hardening** (ticket INFRA-003) - Enhanced GitHub Actions workflows after platform decisions stabilize. Automated tests, security scans, deployment gates, rollback automation

- 🟣 **Platform Baseline Finalization** (ticket INFRA-005) - Lock down hosting provider, observability stack, CDN, DNS, monitoring thresholds

- 🟣 **Tenant Isolation Validation** (ticket INFRA-006) - Automated test matrix verifying organization/space data isolation. Ensure User A cannot access User B's data under any circumstance

- 🟣 **Data Lifecycle Operations** (ticket INFRA-007) - GDPR/CCPA compliance tools for data retention policies, user data export, complete account deletion

- 🟣 **Disaster Recovery** (ticket INFRA-008) - Regular backup verification, restore drills, RTO/RPO definitions, runbooks for data loss scenarios

---

## Architectural Patterns

- ✅ **Context Isolation in Batch API** - Each request in a batch gets its own isolated AppEnv (db, auth, permissions). Prevents one batch operation from leaking context into another. Transaction strategies (transactionAll, transactionPerRound) wrap operations without sharing mutable state
- ✅ **Multi-Strategy Authentication** - Single middleware chain handles session cookies, Bearer tokens, and URL token params. Strategy auto-detected from request headers — no route-level branching. Spoof header (`x-spoof-user-email`) layered on top for superadmin impersonation
- ✅ **False Polymorphism** - Polymorphic relationships (Token owner, CustomerRef) use explicit FK columns instead of type + ID string pairs. Each possible owner type has its own nullable FK. Prisma enforces referential integrity per FK. PolymorphismRegistry centralizes constraints, validation, and FK resolution
- ✅ **Dynamic Schema Generation** - Prisma schema split across one file per model in `prisma/schema/`. Build step concatenates files before generation. Reduces merge conflicts, enables per-model organization, and makes large schemas navigable
- ✅ **Permission-Based Menu Rendering** - Navigation config declares required permissions per item. Menu rendered by evaluating each item's permission against the Permix client. Items hidden (not just disabled) if user lacks permission. Re-evaluated on context switch (org/space change)
- ✅ **Encryption Versioning** - Each encrypted field stores the key version used to encrypt it. Rotation job queries fields WHERE version < current and re-encrypts in batches. CI blocks deploys if version gaps or downgrades detected. Dual-key window (current + previous) enables zero-downtime rotation
- ✅ **Hierarchical Permission Inheritance** - Space permissions cascade from parent organization. Org owners automatically granted owner access to all spaces. Permission middleware resolves hierarchy at check time — no denormalization needed
- ✅ **Request Context Scoping** - AppEnv created per request via AsyncLocalStorage. Contains db client, user, org, space, permissions — all scoped to the current request. No global state. Middleware enriches context; controllers read from it. Concurrent requests never share context
- ✅ **Factory Pattern for Test Data** - `create*()` / `build*()` factories auto-infer relationships (creating a Token auto-creates owning User/Org/Space if not provided). Override only test-relevant fields. Use `entity.__serialize()` when tests need API-shaped values (string timestamps). Shared across all test files, zero duplication

---

## Coming Soon (Ticketed Roadmap)

- 🟣 SAML/SSO integration (ticket AUTH-001, schema/encryption ready, awaiting BetterAuth plugin)
- 🟣 Email system completion (ticket COMM-001, depends on INFRA-002)
- 🟣 Inquiry system UI (ticket FEAT-001, model refinement and onboarding flow)
- 🟣 AI Providers unified layer (ticket FEAT-004, OpenAI/Anthropic/Gemini, tool calling, streaming)
- 🟣 Visual permissions builder (ticket FEAT-008, depends on INFRA-002)
- 🟣 File Management (ticket FEAT-009, upload pipeline, storage providers, scanning, metadata)
- 🟣 Addresses (ticket FEAT-010, normalized model, validation, geocoding, international formatting)
- 🟣 Notifications (ticket FEAT-012, app-events completion + delivery stack)
- 🟣 Fiat Payments (ticket FIN-001, provider decision, subscriptions, invoicing, tax)
- 🟣 Web3 Payments + Wallets (ticket FIN-002, wallet connect, on-chain payments, token-gating)
- 🟣 Rules builder foundation (ticket INFRA-002, dependency for FEAT-008 and COMM-001)
- 🟣 CI/CD baseline hardening (ticket INFRA-003, after platform decisions stabilize)
- 🟣 App events infrastructure (ticket INFRA-004, foundation for FEAT-012)
- 🟣 Platform baseline finalization (ticket INFRA-005, hosting/observability framework)
- 🟣 Tenant isolation validation matrix (ticket INFRA-006)
- 🟣 Data lifecycle operations (ticket INFRA-007, retention/export/delete)
- 🟣 Disaster recovery and restore drills (ticket INFRA-008)
- 🟣 Observability platform (ticket INFRA-009, error tracking and APM - Sentry/Datadog/Betterstack/New Relic/internal)
- 🟣 Product analytics (ticket INFRA-010, user behavior tracking - OpenPanel/Mixpanel/internal)
- 🟣 Storybook component showcase (ticket DEV-001, visual documentation for 50+ UI components)
- 🟣 Visual JSON editor integration (ticket DEV-002, syntax highlighting, collapsible nodes, validation)
- 🟣 Encryption key escrow & lifecycle (ticket FEAT-013, key backup, recovery, admin visibility)
- 🟣 AI Developer Experience (ticket FEAT-014, skills, rules, agents, MCP servers for AI-native development)
- 🟣 Mobile app template (React Native app with shared API/types)
- 🟣 End-to-End Tests (Playwright/Cypress suite not configured)
- 🟣 S3/AWS integration - client scaffolds exist
- 🟣 Stripe integration - client scaffolds exist

---

## Statistics

- **Total Codebase:** ~60,000 lines of TypeScript
  - Backend: ~25,000 lines
  - Frontend: ~15,000 lines
  - Shared Packages: ~20,000 lines
- **Tests:** ~172 test files across packages and API (backend focused, frontend tests minimal)
- **API Endpoints:** 90 route files (one endpoint each) with OpenAPI specs
- **Database Models:** 23 Prisma models with full relations and hooks
- **Frontend Hooks:** 20+ custom hooks for common patterns
- **UI Components:** 50+ Shadcn UI components with variants

---

## Tech Stack

**Backend:**
- Bun 1.3.10 (runtime & package manager)
- Hono ^4.11 (web framework)
- Prisma ^7.2 (ORM)
- PostgreSQL 18 (alpine)
- Redis 7 (alpine)
- BetterAuth ^1.5 (authentication)
- Permix ^0.5 (ReBAC authorization)
- BullMQ ^5.67 (job queue)
- IORedis ^5.9 (Redis client)

**Frontend:**
- React ^19.2 (with React DOM ^19.2)
- TypeScript ^5.9
- TanStack Router ^1.159 (file-based routing)
- TanStack Query ^5.90 (server state)
- Zustand ^5.0 (client state)
- Vite ^7.3 (build tool)
- Tailwind CSS ^4.1 (styling)
- Shadcn UI + React Aria Components (accessible components)
- Lucide React ^0.525 (icons)

**Developer Tools:**
- Turborepo ^2.8 canary (monorepo orchestration)
- Bun native test runner (testing)
- Biome ^2.3 (linting/formatting)
- Docker Compose (local services)
- Infisical (secrets management)
- OpenAPI-TS ^0.86 + Scalar (API docs)
- @hey-api/client-fetch ^0.13 (SDK generation)

---

## 🎯 Unique Selling Points

- ⭐ **Multi-Provider Auth** - Configure OAuth/SAML per organization with encrypted secrets
- ⭐ **ReBAC Permissions** - Advanced relationship-based access control with Permix
- ⭐ **Batch API** - Execute multiple operations atomically with result interpolation
- ⭐ **Route Templates** - Consistent API patterns with automatic OpenAPI docs
- ⭐ **Navigation Config** - Declarative, context-aware, permission-based menus
- ⭐ **Backend Testing** - ~172 test files with factories, backend API fully covered
- ⭐ **Production Ready Backend** - Full job queue, webhooks, caching, OpenTelemetry. Frontend under active development
- ⭐ **Field-Level Encryption** - AES-256-GCM with registry pattern, auto-rotation, CI validation
- ⭐ **Developer Experience** - Hot reload, monorepo tooling, type-safe everything
- 🟣 **AI-Native** - Built-in skills, rules, agents, and MCP servers for AI coding assistants (coming soon)
