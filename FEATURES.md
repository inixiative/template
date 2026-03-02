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
- ✅ Docker Compose setup (PostgreSQL 17, Redis 7, API dev mode)
- ✅ TypeScript 5 with strict mode across all packages
- 🟡 Init script with React Ink TUI - core complete, additional features in progress

---

## API Architecture & Routing

- ✅ Hono web framework with type-safe routing
- ✅ Standardized CRUD templates (readRoute, createRoute, updateRoute, deleteRoute, actionRoute)
- ✅ `Modules` constant for type-safe model names
- ✅ Resource context middleware - auto-loads `:id` param with custom inclusions
- ✅ Request context scoping with unified AppEnv types
- ✅ Context isolation between batch sub-requests
- ✅ Bracket notation filtering (`?filter[field]=value`)
- ✅ Path notation for nested filters
- ✅ Searchable fields for full-text search (`?search=query`)
- ✅ Response metadata (pagination info, total counts)
- ✅ Batch execution API with result interpolation
- ✅ Batch API transaction support
- ✅ Batch API parallel and sequential execution strategies
- ✅ OpenAPI generation with Scalar UI at `/docs`
- ✅ TypeScript SDK auto-generated from OpenAPI spec
- ✅ TanStack Query hooks auto-generated from SDK
- ✅ Query keys auto-generated with type safety
- ✅ Unified error contract (error, message, guidance, fieldErrors, requestId)
- ✅ Error normalization middleware for Zod and Prisma errors
- ✅ CORS configuration with environment-based origins
- ✅ 72+ documented REST endpoints across all modules

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
- 🟣 SAML/SSO integration (ticket AUTH-001, schema ready, awaiting BetterAuth plugin maturity)

---

## Authorization & Permissions

- ✅ RBAC (Role-Based Access Control) at platform, org, and space levels
- ✅ Platform roles: superadmin, user
- ✅ Organization roles: owner, admin, member
- ✅ Space roles: owner, admin, member
- ✅ Fine-grained entitlements (JSON overrides) at org and space level
- ✅ ReBAC (Relationship-Based Access Control) with Permify integration
- ✅ Hierarchical relationship-based permissions (User → OrgUser → Org)
- ✅ Space permissions inherit from parent organization
- ✅ Org owners automatically get owner access to all spaces
- ✅ Permission validation middleware (validatePermission, validateOwnerPermission)
- ✅ Superadmin bypass for all permission checks
- ✅ Permission checks scoped to organization and space contexts
- ✅ Permix client setup per request with fresh instance
- ✅ Permission caching in Redis for performance
- 🟣 Visual permissions builder UX (ticket FEAT-008, depends on INFRA-002)

---

## Multi-Tenancy

- ✅ Organizations with full CRUD and data isolation
- ✅ Organization memberships (OrganizationUser) with roles
- ✅ Organization settings and configuration
- ✅ Organization-scoped tokens
- ✅ Organization-specific auth providers
- ✅ Invite users to organizations with email
- ✅ Manage organization user roles and permissions
- ✅ Spaces as flexible containers within organizations
- ✅ Space CRUD operations with data isolation
- ✅ Space memberships (SpaceUser) requiring org membership first
- ✅ Space-scoped tokens
- ✅ Hierarchical permissions (spaces inherit from parent org)
- ✅ Context switching between User, Organization, Space, and Public contexts
- ✅ URL param syncing for context (`?org=`, `?space=`)
- ✅ Context-aware navigation and permission checks
- ✅ Frontend store tracks current tenant context

---

## Database & ORM

- ✅ Prisma 7 (preview) with PostgreSQL 17
- ✅ Split schema files (one per model) in `packages/db/prisma/schema/`
- ✅ Typed model IDs (OrganizationId, UserId, SpaceId, etc.) for type safety
- ✅ Zod schema generation for request/response validation
- ✅ Client extensions and middleware support
- ✅ UUID v7 for time-sortable IDs
- ✅ False polymorphism support (Token, CustomerRef models)
- ✅ Database scoping for request tracing and logging
- ✅ Database utilities: dump, restore, clone (auto-truncates webhooks on clone)
- ✅ Transaction isolation in tests
- ✅ 18 database models: user, account, session, verification, authProvider, organization, organizationUser, space, spaceUser, token, webhookSubscription, webhookEvent, inquiry, customer, cronJob, emailTemplate, emailComponent, appEvent
- ✅ Mutation lifecycle hooks (beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete)
- ✅ Type-safe hook registration with async and transaction support
- ✅ Multiple hooks per event with webhook and cache invalidation integration
- ✅ Test factory system (create* functions) with auto-inferred relationships
- ✅ Factory override support for custom test data
- ✅ Faker integration for realistic test data
- ✅ Prime seed data for development (predefined users, org, space, tokens)
- ✅ Dynamic schema generation from split files

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

- ✅ BullMQ job queue with Redis backend
- ✅ Job scheduling and priority support
- ✅ Retry with exponential backoff
- ✅ Cron job registration and management
- ✅ CronJob model for persistence
- ✅ Job queues: default (general tasks), email (email delivery), webhooks (webhook processing)
- ✅ Job handlers: email delivery, webhook processing, token cleanup
- ✅ Graceful worker shutdown
- ✅ Job status tracking and monitoring
- ✅ BullBoard integration for admin monitoring

---

## Webhooks

- ✅ Webhook subscription CRUD operations
- ✅ Event-based webhook triggers (user.created, organization.updated, etc.)
- ✅ HMAC signature verification for webhook security (x-webhook-signature header)
- ✅ Webhook retry logic (3 attempts with exponential backoff)
- ✅ Webhook delivery status tracking
- ✅ Async webhook delivery via job queue
- ✅ WebhookEvent model with status tracking
- ✅ Webhook payload validation
- ✅ Event cleanup cron job for old webhook events

---

## Real-Time & Feature Management

- 🟡 App events infrastructure - AppEvent model, basic event dispatch
- 🟡 WebSocket support - foundations exist, not fully integrated
- 🟡 Feature flags - infrastructure planned, not implemented

---

## Email System

- ✅ Email template management (MJML templates)
- ✅ Email component system (reusable MJML components)
- ✅ Polymorphic email template support
- ✅ Email locale support for internationalization
- ✅ Multiple email clients (Resend, Postmark, SendGrid, console)
- ✅ Email validation and rendering pipeline
- ✅ Email job queue integration
- ✅ EmailTemplate model for database-driven templates
- ✅ EmailComponent model for reusable components
- 🟡 Email provider configuration - SendGrid, Postmark, Resend clients ready
- 🟡 Email templates not implemented for common flows
- 🟣 Email system completion (ticket COMM-001, depends on INFRA-002)

---

## Encryption & Security

### Field-Level Encryption Engine

- ✅ AES-256-GCM field-level encryption with per-field version tracking
- ✅ Encryption registry pattern (`ENCRYPTED_MODELS`) — add model/field, zero code changes needed
- ✅ Auto-discovery rotation job — one generic job handles all models/fields forever
- ✅ Type-safe helpers — `encryptField<M, K>()` and `decryptField()` with TypeScript generics
- ✅ Additional Authenticated Data (AAD) binds ciphertext to immutable record fields
- ✅ Idempotent key rotation — version precondition in WHERE clause prevents race conditions
- ✅ Singleton job locking — Redis-based lock with heartbeat prevents concurrent rotation
- ✅ CI validation — blocks deployment on version downgrades, gaps, or mixed versions
- ✅ Dual-key support — current + previous keys for zero-downtime rotation
- ✅ Environment-based key management (3 env vars per keyring)
- ✅ BullBoard monitoring for rotation job progress
- ✅ Comprehensive test suite (encryption service, helpers, validation, env validation)
- ✅ AuthProvider secrets encrypted at rest (OAuth client secrets, SAML certificates)
- 🟣 Key escrow/backup system (ticket FEAT-013, prevent catastrophic data loss from key deletion)
- 🟣 Key lifecycle management (ticket FEAT-013, rotation age tracking, backup validation)
- 🟣 Encryption admin dashboard (ticket FEAT-013, health checks, version status visibility)

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
- ✅ User profile management
- ✅ User settings and preferences
- ✅ User redaction/anonymization (GDPR compliance)
- ✅ Me endpoint system (self-service API with 8+ endpoints)
- ✅ Email verification flow
- ✅ Password reset flow
- ✅ User-scoped tokens for API access

---

## Inquiry System

- ✅ Inquiry CRUD operations
- ✅ Inquiry state actions (send, sent, receive, received, resolve, cancel)
- ✅ Inquiry routing and state transitions
- ✅ Polymorphic inquiry support (false polymorphism)
- ✅ Inquiry status tracking
- 🟣 Inquiry system UI (ticket FEAT-001, model refinement and onboarding flow)

---

## Customer Management

- 🟡 Customer model schema exists, not integrated into API/UI
- 🟡 Customer reference support (polymorphic false polymorphism pattern)

---

## Frontend Apps

- ✅ Web App (`apps/web/`) - Customer-facing application
- ✅ Web: User dashboard, organization management, space management, settings
- ✅ Admin App (`apps/admin/`) - Organization administrator interface
- ✅ Admin: User management, token management, webhook subscriptions, auth provider config
- ✅ Superadmin App (`apps/superadmin/`) - Platform administrator interface
- ✅ Superadmin: Platform dashboard, all organizations view, user spoofing, platform auth providers

---

## Frontend Architecture

- ✅ React 18 + TypeScript 5
- ✅ TanStack Router v2 with file-based routing
- ✅ TanStack Query v5 for data fetching and caching
- ✅ Zustand state management with 6 slices (auth, tenant, permissions, navigation, ui, client)
- ✅ Slice factories for testability
- ✅ Tailwind CSS + Shadcn UI components
- ✅ Vite build tool with HMR
- ✅ Declarative navigation config with context/feature split architecture
- ✅ Navigation organized by context (user/org/space/public) and feature
- ✅ Permission-based menu rendering (items only show if user has permission)
- ✅ Context-aware route generation with `getContextParams()`
- ✅ Feature cohesion (all organization routes together)
- ✅ Navigation config reusable across apps
- ✅ API client wrappers (apiQuery for queries, apiMutation for mutations)
- ✅ `apiQuery` unwraps `data.data` for convenient query usage
- ✅ `apiMutation` returns full response for optimistic update patterns
- ✅ Both wrappers handle authentication and spoof headers
- ✅ Route guards (requireAuth, requirePublic) with redirect support
- ✅ Guards preserve context search params (`?org=`, `?space=`, `?spoof=`)

---

## UI Components

- ✅ AppShell - Main layout with sidebar, header, breadcrumbs (auto-wired to store)
- ✅ DataTable - Sortable, filterable, paginated tables with @tanstack/react-table v8
- ✅ DataTable configuration builder for rapid table creation
- ✅ ContextSelector - Organization/space switcher dropdown
- ✅ UserMenu - User dropdown with profile, settings, logout, spoof badge
- ✅ Sidebar - Navigation menu with permission filtering
- ✅ Forms with react-hook-form integration
- ✅ Input components (text, email, password, select, checkbox, radio)
- ✅ Button variants (primary, secondary, destructive, ghost, link)
- ✅ Card components for content organization
- ✅ Modal/Dialog components with portal rendering
- ✅ Toast notifications for user feedback
- ✅ Badge components for status indicators
- ✅ Dropdown menus with keyboard navigation
- ✅ Tabs for content organization
- ✅ 50+ Shadcn UI components
- 🟣 Visual JSON editor integration (ticket DEV-002, syntax highlighting, collapsible nodes, validation)

---

## Frontend Hooks

- ✅ `useAuthenticatedRouting()` - Handles auth redirect and context sync
- ✅ `useOptimisticMutation()` - Optimistic UI updates for lists
- ✅ `useValidateUniqueness()` - Real-time uniqueness validation
- ✅ `useEventRefetch()` - Refetch queries on custom events
- ✅ `useBreadcrumbs()` - Generate breadcrumbs from route config
- ✅ `useAuthProviders()` - Fetch and manage auth providers
- ✅ `useAppEvents()` - Subscribe to app events
- ✅ `useDarkMode()` - Dark mode toggle and persistence
- ✅ `useLanguage()` - Language selection and i18n
- ✅ `usePageMeta()` - Set page title and meta tags
- ✅ `usePermission()` - Check user permissions
- ✅ `useSpaceTheme()` - Space-specific theming
- ✅ `useMediaQuery()` - Responsive design helpers
- ✅ `useDebounce()` - Debounced values for search/filter
- ✅ `useAuthStrategy()` - Multi-provider auth strategy selection
- ✅ 20+ custom hooks for common patterns

---

## Developer Experience

- ✅ Hot reload across workspace dependencies with Turborepo watch mode
- ✅ 250+ unit and integration tests with Vitest
- ✅ Test factory functions for deterministic test data
- ✅ Database transaction isolation per test
- ✅ React Testing Library for frontend component tests
- ✅ Biome for linting and formatting
- ✅ TypeScript strict mode type checking
- ✅ Custom lint checks: checkImportAliases.sh (enforces `#/` path alias)
- ✅ Custom lint checks: checkGeneratedFiles.sh (verifies Prisma/OpenAPI SDK)
- ✅ Custom lint checks: runPostBiomeChecks.sh (orchestrates all checks for CI)
- ✅ Pre-commit hooks (optional)
- ✅ OpenAPI SDK auto-generation with type safety
- ✅ Prisma client + Zod schemas auto-generation
- ✅ Make middleware/controller factories for boilerplate reduction
- ✅ DataTable configuration builder for rapid table creation
- ✅ Route guards with context preservation

---

## Infrastructure & DevOps

- ✅ Docker Compose with PostgreSQL 17, Redis 7, API dev mode
- ✅ Three deployment environments: pr (ephemeral), staging, prod
- ✅ Infisical secret management (migrated from Doppler)
- ✅ Environment variable injection via `with-env.sh`
- ✅ Redis caching with Ioredis client
- ✅ Redis use cases: session cache (5min), permission cache, token cache (10min), job queue
- ✅ Namespace support for Redis keys
- ✅ Structured logging with Consola
- ✅ Log scopes: auth, db, api, jobs
- ✅ Request ID correlation across logs
- ✅ Database utilities: dump, restore, clone with webhook auto-truncation
- 🟡 OpenTelemetry traces - optional, not configured
- 🟣 Observability platform (ticket INFRA-009, error tracking and APM - evaluating Sentry/Datadog/Betterstack/New Relic/internal)
- 🟣 Product analytics (ticket INFRA-010, user behavior tracking - evaluating OpenPanel/Mixpanel/internal)
- 🟣 CI/CD baseline hardening (ticket INFRA-003, after platform decisions stabilize)
- 🟣 Platform baseline finalization (ticket INFRA-005, hosting/observability framework)
- 🟣 Tenant isolation validation matrix (ticket INFRA-006)
- 🟣 Data lifecycle operations (ticket INFRA-007, retention/export/delete)
- 🟣 Disaster recovery and restore drills (ticket INFRA-008)

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
- **Tests:** 250+ unit and integration tests with 100% factory coverage
- **API Endpoints:** 70+ documented REST endpoints with OpenAPI specs
- **Database Models:** 18 Prisma models with full relations and hooks
- **Frontend Hooks:** 20+ custom hooks for common patterns
- **UI Components:** 50+ Shadcn UI components with variants

---

## Tech Stack

**Backend:**
- Bun (runtime & package manager)
- Hono (web framework)
- Prisma 7 preview (ORM)
- BetterAuth (authentication)
- Permify (authorization)
- BullMQ (job queue)
- PostgreSQL 17
- Redis 7

**Frontend:**
- React 18
- TypeScript 5
- TanStack Router v2
- TanStack Query v5
- Zustand (state)
- Tailwind CSS + Shadcn UI
- Vite

**Developer Tools:**
- Turborepo (monorepo orchestration)
- Vitest (testing)
- Biome (linting/formatting)
- Docker Compose
- Infisical (secrets management)
- OpenAPI + Scalar (API docs)

---

## 🎯 Unique Selling Points

- ⭐ **Multi-Provider Auth** - Configure OAuth/SAML per organization with encrypted secrets
- ⭐ **ReBAC Permissions** - Advanced relationship-based access control with Permify
- ⭐ **Batch API** - Execute multiple operations atomically with result interpolation
- ⭐ **Route Templates** - Consistent API patterns with automatic OpenAPI docs
- ⭐ **Navigation Config** - Declarative, context-aware, permission-based menus
- ⭐ **Comprehensive Testing** - 250+ tests with factories and transaction isolation
- ⭐ **Production Ready** - Full observability, job queue, webhooks, caching
- ⭐ **Field-Level Encryption** - AES-256-GCM with registry pattern, auto-rotation, CI validation
- ⭐ **Developer Experience** - Hot reload, monorepo tooling, type-safe everything
- 🟣 **AI-Native** - Built-in skills, rules, agents, and MCP servers for AI coding assistants (coming soon)
