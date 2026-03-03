# Template Features

Comprehensive SaaS starter template with multi-tenancy, ReBAC permissions, and modern TypeScript stack.

**Last Updated:** 2026-03-02

## How to Read This

- **✅ Complete** - Feature is implemented and tested
- **🟡 In Progress** - Actively being developed, partial implementation exists
- **🟣 Coming Soon** - Planned work with tickets (see Coming Soon section for full roadmap)

**Looking for something specific?** Use browser search (Cmd+F / Ctrl+F) to find features by keyword.

---

## Core Platform

- ✅ Monorepo architecture - 4 apps (web, admin, superadmin, api) + shared packages
- ✅ Bun runtime and package manager
- ✅ Turborepo orchestration with watch mode for hot reload
- ✅ Workspace-level build/typecheck/test tooling
- ✅ Multi-environment setup (pr, staging, prod) with Infisical
- ✅ Environment composition via `with-env.sh` for secret injection
- ✅ Docker Compose for supporting services (PostgreSQL 18, Redis 7)
- ✅ TypeScript 5 with strict mode across all packages
- 🟡 Init script with React Ink TUI - core complete, additional features in progress

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

- ✅ BetterAuth integration for session and token auth
- ✅ Email/password authentication with bcrypt hashing
- ✅ Stateless JWT sessions with cookieCache strategy (5-minute cache window)
- ✅ HTTP-only cookies with CSRF protection (double-submit cookie)
- ✅ Redis secondary storage for frequently-accessed data
- ✅ OAuth via BetterAuth social providers (Google, Microsoft, GitHub)
- ✅ Multi-provider authentication (AuthProvider) - platform and org-specific configs
- ✅ Platform providers available to all organizations
- ✅ Organization-specific providers for custom OAuth/SAML configurations
- ✅ AES-256-GCM encrypted secrets for OAuth client secrets
- ✅ Key rotation support via encryption version tracking
- ✅ Full CRUD API for auth provider management
- ✅ Bearer token API authentication (`Authorization: Bearer <key>`)
- ✅ URL token parameter fallback for WebSocket/emails (`?token=`)
- ✅ SHA-256 token hashing with 10-minute Redis cache
- ✅ User, Organization, and Space-scoped tokens
- ✅ Personal access tokens with expiry
- ✅ Token CRUD operations with usage tracking
- ✅ Session model with BetterAuth persistence
- ✅ Verification model for email verification
- ✅ Account model for OAuth linkage
- ✅ User impersonation (spoofing) for superadmins via `x-spoof-user-email` header
- ✅ Spoof status in response headers (x-spoofing-user-email, x-spoofed-user-email)
- ✅ Frontend spoof badge UI with clear function
- 🟡 Session refresh - Token refresh/silent re-auth not yet implemented
- 🟣 SAML/SSO integration (ticket AUTH-001, schema ready, awaiting BetterAuth plugin maturity)

---

## Authorization & Permissions

**Full RBAC/ABAC/ReBAC Authorization** - Comprehensive permission system supporting Role-Based (RBAC), Attribute-Based (ABAC), and Relationship-Based (ReBAC) access control powered by Permify with JSON-Rules support. This unified system lets you define permissions using simple roles, complex attribute-based rules, or relationship graphs - all within the same framework. JSON-Rules integration enables dynamic permission logic without code deployment.

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

- ✅ **Test Factory System** - `create*()` functions generate realistic test data with Faker integration. Auto-infers relationships (creating user automatically creates account if needed). Override only what matters for your test. 100% model coverage with factories. [Learn more: TESTING.md](docs/claude/TESTING.md)

- ✅ **Database Utilities** - dump, restore, and clone operations for database management. Clone auto-truncates webhook subscriptions to prevent duplicate deliveries in copied environments

- ✅ **UUID v7 IDs** - Time-sortable UUIDs for chronological ordering without exposing creation timestamps. Better index performance than UUID v4

- ✅ **Request Scoping** - Database client scoped per-request for tracing and logging. All queries tagged with request ID for debugging

- ✅ **Transaction Isolation in Tests** - Each test runs in isolated transaction, rolled back after test completes. Ensures tests don't interfere with each other

- ✅ **18 Database Models** - user, account, session, verification, authProvider, organization, organizationUser, space, spaceUser, token, webhookSubscription, webhookEvent, inquiry, customer, cronJob, emailTemplate, emailComponent, appEvent

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

- ✅ Admin cache clearing endpoint (`/admin/cache/clear`)
- ✅ Admin cron job CRUD operations
- ✅ Admin manual cron job triggering
- ✅ Admin job enqueueing interface
- ✅ Admin inquiry oversight and management
- ✅ Admin webhook oversight and debugging
- ✅ BullBoard UI at `/admin/queues` for job monitoring
- ✅ Admin platform auth provider management
- ✅ Admin organization overview and management

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

**Event-Driven Integration System** - Notify external systems when data changes. Organizations/spaces subscribe to events, receive HMAC-signed payloads. Automatic retries, delivery tracking, and async processing via job queue.

- ✅ **Webhook Subscriptions** - Organizations and spaces can subscribe to events (user.created, organization.updated, etc.). Each subscription has URL, events list, secret for HMAC signing, and active/inactive status. False polymorphism pattern allows User/Organization/Space ownership

- ✅ **Event-Based Triggers** - Database hooks automatically fire webhook deliveries after successful mutations. Hook system ensures webhooks only sent after transaction commits. Events follow pattern: `{resource}.{action}` (user.created, token.deleted)

- ✅ **HMAC Signature Verification** - Each webhook includes `x-webhook-signature` header with HMAC-SHA256 signature. Receiving systems verify payload authenticity using shared secret. Prevents webhook spoofing and tampering

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

- ✅ **Event Broadcasting Pattern** - Infrastructure ready for app events to broadcast over WebSocket. Planned pattern: register app event handler that publishes to relevant channels based on event resource type/ID. Not yet wired up but all plumbing exists

- 🟣 **App Events System** - Event emitter pattern for business events (user.signedUp, resource.updated) planned but not implemented. Would enable decoupled event handlers for notifications, analytics, webhooks, and WebSocket broadcasts. Infrastructure exists (WebSocket, handlers, types) but event emission and registration not built yet. (ticket INFRA-004)

- 🟣 **Feature Flags** - Runtime feature toggles not implemented. Would enable gradual rollouts, A/B testing, and emergency kill switches. Could integrate with external services (LaunchDarkly, Unleash) or build internal Redis-backed solution

[Learn more: APP_EVENTS.md](docs/claude/APP_EVENTS.md)

---

## Email System

**Database-Driven Email Templates with Multi-Tenancy** - MJML-based email system with reusable components, variable substitution, and polymorphic ownership. Organizations can customize templates with their branding. Schema and infrastructure ready, awaiting provider configuration and template authoring.

- ✅ **EmailTemplate Schema** - Database model for email templates using MJML (responsive email markup). Templates have slug (otp, welcome), locale (en, es), subject with variables (`{{code}}`), and full MJML body with `{{component:slug}}` references and `{{variable.*}}` placeholders. Category (system/promotional) controls unsubscribe requirements

- ✅ **EmailComponent Schema** - Reusable MJML components (headers, footers, buttons) referenced by templates via `{{component:default-header}}`. Components can nest other components. Pre-computed `componentRefs` array tracks dependencies for resolution

- ✅ **Polymorphic Ownership** - False polymorphism pattern enables templates at four levels: **default** (platform-wide, all tenants), **admin** (platform internal only), **Organization** (tenant-branded), **Space** (space-specific overrides). Orgs can customize templates while inheriting platform defaults. `inheritToSpaces` flag controls whether org templates cascade to spaces

- ✅ **Locale Support** - Multi-language templates via locale field. Unique constraint on (slug, locale, owner) allows same template in multiple languages. Template lookup resolves to user's locale or falls back to `en`

- ✅ **Communication Categories** - System emails (OTP, password reset, security) cannot be unsubscribed. Promotional emails (newsletters, marketing) include unsubscribe link. Category enforced at send time

- ✅ **Email Clients** - Resend client (production) and Console client (dev/test) implemented in `packages/email`. Clients provide unified interface for sending with from/to/subject/html. No Postmark or SendGrid clients

- ✅ **Template Rendering Pipeline** - Complete MJML rendering system in `packages/email/src/render/`: `compose()` fetches templates and recursively expands `{{component:slug}}` refs, `interpolate()` substitutes `{{variable.*}}` placeholders, `expand()` handles nested components, `lookupCascade()` resolves templates with owner fallbacks (Space → Org → default). MJML validation included. Ready to use, just needs API endpoint wiring

- 🟡 **Common Flow Templates** - No templates created yet for standard flows (welcome email, password reset, email verification, invitation). Each needs MJML authoring and variable schema definition

- 🟡 **Job Queue Integration** - Email sending should enqueue as background jobs to avoid blocking requests and enable retries. Pattern exists (see webhooks) but not wired for emails

- 🟣 **Email System Completion** (ticket COMM-001, depends on INFRA-002) - Wire up template rendering, configure providers, author standard templates, integrate with job queue, add admin UI for template management

[Learn more: COMMUNICATIONS.md](docs/claude/COMMUNICATIONS.md)

---

## Encryption & Security

### Field-Level Encryption Engine

- ✅ AES-256-GCM encryption with per-field version tracking
- ✅ Registry pattern (`ENCRYPTED_MODELS`) — add field, zero code changes
- ✅ Auto-discovery rotation — one job handles all models/fields
- ✅ Type-safe `encryptField<M, K>()` / `decryptField()` generics
- ✅ AAD binds ciphertext to immutable record fields
- ✅ Idempotent rotation via version precondition in WHERE clause
- ✅ Singleton job locking — Redis lock with heartbeat
- ✅ CI blocks deployment on version downgrades, gaps, or mixed versions
- ✅ Dual-key zero-downtime rotation (current + previous)
- ✅ 3 env vars per keyring
- ✅ BullBoard rotation monitoring
- ✅ Full test suite (service, helpers, validation, env)
- ✅ AuthProvider secrets encrypted at rest
- 🟣 Key escrow & lifecycle (ticket FEAT-013)
- 🟣 Encryption admin dashboard (ticket FEAT-013)

### General Security

- ✅ HTTP-only cookies for session security
- ✅ CSRF protection (BetterAuth double-submit cookie pattern)
- ✅ SQL injection prevention (Prisma parameterized queries)
- ✅ XSS prevention (React automatic escaping)
- ✅ Password hashing with bcrypt (BetterAuth)
- ✅ Token hashing with SHA-256
- 🟣 Rate limiting - infrastructure ready with Redis, implementation pending
- 🟣 Audit logs - infrastructure ready with logging system, implementation pending

---

## User Management

- ✅ User CRUD operations
- 🟡 User profile management - Profile page is read-only (intentional, editing not yet implemented)
- 🟡 User settings and preferences - Settings pages exist as placeholders, not yet implemented
- ✅ User redaction/anonymization (GDPR compliance)
- ✅ Me endpoint system (self-service API with 8+ endpoints)
- ✅ Email verification flow
- ✅ Password reset flow
- ✅ User-scoped tokens for API access

---

## Inquiry System

**Standardized Request/Approval/Audit Primitive** - Instead of building ad-hoc handlers for every common org action (invite user, create space, transfer ownership, request access), the Inquiry system provides a unified pattern: create a request, route it for approval, execute the resolution, and log the interaction. Every team reinvents this — having it as a first-class primitive means consistent behavior, audit trails, and extensibility across all org workflows.

- 🟡 **Core API** - CRUD operations and state machine (draft → sent → acknowledged → resolved/canceled) exist. Resolution logic being refactored to match current schema
- 🟡 **Resolution Actions** - Approved inquiries execute their side effects (create org membership, provision space, etc.). Refactoring in progress
- ✅ **Polymorphic Ownership** - False polymorphism pattern supports inquiries owned by Users, Organizations, or Spaces. Source and target can be any resource type
- ✅ **Status Tracking** - Full state machine with transitions, timestamps, and resolution metadata (outcome, explanation, resolvedBy, resolvedAt)
- 🟡 **UI and flow completion** (ticket FEAT-001) - Invitation flow, approval UI, and onboarding integrations in progress

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

- ✅ **Core Primitives** - Avatar, Badge, Breadcrumb, Button, Card, DropdownMenu, EmptyState, Input, Label, Select, Table, ThemeToggle

- ✅ **AppShell** - Main application layout with sidebar, header, and breadcrumb navigation. Wires to Zustand store for current user, org, space

- ✅ **Sidebar** - Collapsible navigation menu with permission-based item filtering, active state, and route highlighting

- ✅ **UserMenu** - Profile dropdown with avatar, name, email, logout, and spoof badge for impersonation

- ✅ **ContextSelector** - Dropdown for switching organizations and spaces, updates URL params and global state

- ✅ **DataTable** - Table primitive with sorting, filtering, pagination, row selection via @tanstack/react-table. Configuration builder reduces setup boilerplate

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

- ✅ **Plus**: useAuthProviders, useAppEvents, useDarkMode, useLanguage, usePageMeta, and more
- 🟡 **useSpaceTheme** - Hook exists but returns mock values; space theming not yet wired to real data

---

## Developer Experience

**Fast Iteration with Strong Guardrails** - Lightning-fast hot reload across monorepo, comprehensive test suite with factories, automatic code generation, strict type checking, and custom lint rules. Everything optimized for velocity without sacrificing quality.

### Development Workflow

- ✅ **Turborepo Watch Mode** - Hot reload across workspace dependencies. Change shared package code and all consuming apps reload instantly. No manual rebuilds. `turbo watch local` runs all apps, `turbo watch local#api` filters to specific package. Task caching skips unchanged work

- ✅ **Bun Hot Reload** - Native `--hot` flag reloads API/worker on file changes in <100ms. Vite HMR for frontends preserves React state across edits. Development iteration loop measured in milliseconds, not seconds

- ✅ **Path Aliases** - Clean imports with `#/` (internal) and `@template/*` (cross-package). No `../../../` relative imports. TypeScript and build tools resolve aliases automatically. Custom lint check enforces usage

### Testing & Quality

- ✅ **93 Test Files with Vitest** - Unit and integration tests, backend focused. Fast execution with watch mode for TDD workflow. Frontend app tests minimal (web/admin/superadmin apps have near-zero coverage)

- ✅ **Test Factories with Faker** - `create*()` and `build*()` functions generate realistic test data. `create*()` persists to DB, `build*()` is in-memory only. Auto-infers relationships (creating user auto-creates account). Override only what matters for your test. 100% model coverage. Tests run against a dedicated test database

- ✅ **Mock Webhook Receiver** - Test module mounts a `POST /test/webhook` endpoint in test environment only. Stores received webhook payloads in-memory (`receivedWebhooks[]`) so tests can assert on delivery, headers, and HMAC signatures. `clearReceivedWebhooks()` resets between tests. Enables real end-to-end webhook delivery tests without external services

- ✅ **Automatic Test Cleanup** - Database hooks track which tables were touched during tests. `cleanupTouchedTables()` utility truncates only modified tables after test suite completes. Temporarily disables FK constraints, uses TRUNCATE CASCADE for efficiency. Prevents test data buildup without manual cleanup

- ✅ **React Testing Library** - Component tests follow best practices (test behavior, not implementation). User-centric queries (getByRole, getByLabelText). Async utilities for loading states

### Type Safety & Code Generation

- ✅ **TypeScript Strict Mode** - Strictest compiler settings across all packages. No `any`, null checks enforced, proper error handling required. Catches bugs at compile time, not runtime

- ✅ **OpenAPI SDK Auto-Generation** - Type-safe client SDK generated from route definitions. Every endpoint becomes typed function with request/response inference. Changes to API automatically flow to frontend types. Run `generate:sdk` after route changes

- ✅ **Prisma + Zod Generation** - Prisma client and Zod schemas auto-generated from schema. Input schemas for validation, model schemas for responses. Run `db:generate` after schema changes. Never manually write validation schemas

- ✅ **Route Tree Generation** - TanStack Router scans route files and generates type-safe routing tree. Navigation autocompletes paths, params strongly typed. Run `generate:routes` after adding routes

### Linting & Formatting

- ✅ **Biome** - Fast linting and formatting (10x faster than ESLint+Prettier). Consistent code style across monorepo. Auto-fix on save. `bun run lint` checks all packages

- ✅ **Custom Lint Checks** - Three custom validators run in CI: `checkImportAliases.sh` (enforces `#/` imports), `checkGeneratedFiles.sh` (ensures Prisma/OpenAPI SDK up to date), `runPostBiomeChecks.sh` (orchestrates all checks). Prevents common mistakes

- ✅ **Optional Pre-commit Hooks** - Git hooks available for local validation before commit. Not enforced (developer choice) but recommended. Runs lint + type check on staged files

### Boilerplate Reduction

- ✅ **makeController() Factory** - Generates type-safe responders from route definition. Eliminates manual response construction and validation. One factory replaces 20+ lines per endpoint

- ✅ **makeError() Factory** - Standardized error creation with guidance text. No more manual HTTPException construction. Consistent error shapes across API

- ✅ **Route Templates** - Pre-built patterns (readRoute, createRoute, updateRoute) reduce API definition from ~100 lines to ~20 lines. Enforces consistency while eliminating boilerplate

- ✅ **DataTable Configuration Builder** - Rapid table creation for list views. Declarative config generates sorting, filtering, pagination, selection. Reduces table setup from 100+ lines to 10-20 lines

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

- 🟡 **Sentry Error Tracking** - Error tracking scaffolded via `@sentry/bun` imports in error middleware, but not fully configured. Would capture 5xx errors and unhandled exceptions when `SENTRY_ENABLED=true` and `SENTRY_DSN` set. Part of broader observability platform decision

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

- 🟣 **Observability Platform Decision** (ticket INFRA-009) - Evaluate Sentry, Datadog, Betterstack, New Relic, or build internal. Centralizes error tracking, APM, logs, and metrics. Blocking decision for full production readiness

- 🟣 **Product Analytics** (ticket INFRA-010) - User behavior tracking for product decisions. Evaluating OpenPanel, Mixpanel, or internal solution. Track page views, feature usage, funnels, retention

- 🟣 **CI/CD Hardening** (ticket INFRA-003) - Enhanced GitHub Actions workflows after platform decisions stabilize. Automated tests, security scans, deployment gates, rollback automation

- 🟣 **Platform Baseline Finalization** (ticket INFRA-005) - Lock down hosting provider, observability stack, CDN, DNS, monitoring thresholds

- 🟣 **Tenant Isolation Validation** (ticket INFRA-006) - Automated test matrix verifying organization/space data isolation. Ensure User A cannot access User B's data under any circumstance

- 🟣 **Data Lifecycle Operations** (ticket INFRA-007) - GDPR/CCPA compliance tools for data retention policies, user data export, complete account deletion

- 🟣 **Disaster Recovery** (ticket INFRA-008) - Regular backup verification, restore drills, RTO/RPO definitions, runbooks for data loss scenarios

---

## Architectural Patterns

- ✅ Context isolation in batch API
- ✅ Multi-strategy authentication (session, token, OAuth)
- ✅ Polymorphic database patterns (false polymorphism for Token, CustomerRef)
- ✅ Dynamic schema generation from split files
- ✅ Permission-based menu rendering
- ✅ Encryption versioning for key rotation
- ✅ Hierarchical permission inheritance
- ✅ Request context scoping across middleware
- ✅ Factory pattern for test data generation

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
- **Tests:** 93 test files across packages and API (backend focused, frontend tests minimal)
- **API Endpoints:** 70+ documented REST endpoints with OpenAPI specs
- **Database Models:** 18 Prisma models with full relations and hooks
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
- Vitest ^4.0 (testing)
- Biome ^2.3 (linting/formatting)
- Docker Compose (local services)
- Infisical (secrets management)
- OpenAPI-TS ^0.86 + Scalar (API docs)
- @hey-api/client-fetch ^0.13 (SDK generation)

---

## 🎯 Unique Selling Points

- ⭐ **Multi-Provider Auth** - Configure OAuth/SAML per organization with encrypted secrets
- ⭐ **ReBAC Permissions** - Advanced relationship-based access control with Permify
- ⭐ **Batch API** - Execute multiple operations atomically with result interpolation
- ⭐ **Route Templates** - Consistent API patterns with automatic OpenAPI docs
- ⭐ **Navigation Config** - Declarative, context-aware, permission-based menus
- ⭐ **Backend Testing** - 93 test files with factories, backend API fully covered
- ⭐ **Production Ready Backend** - Full job queue, webhooks, caching, OpenTelemetry. Frontend under active development
- ⭐ **Field-Level Encryption** - AES-256-GCM with registry pattern, auto-rotation, CI validation
- ⭐ **Developer Experience** - Hot reload, monorepo tooling, type-safe everything
- 🟣 **AI-Native** - Built-in skills, rules, agents, and MCP servers for AI coding assistants (coming soon)
