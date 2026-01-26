# Template Progress

## Structure

```
apps/
├── api          ✅ Core API with Hono + Prisma 7
├── web          ✅ React + Vite + Tailwind v4
├── admin        🔲 Org admin dashboard
└── superadmin   🔲 Platform admin dashboard

packages/
├── db           ✅ Prisma 7, typed IDs, extensions, unified db client
├── permissions  ✅ Permix-based RBAC
├── shared       ✅ Shared types/utils
└── ui           🔲 Shared UI (shadcn)
```

## API Core (apps/api)

### Middleware
- [x] cors - Origin validation by env
- [x] prepareRequest - Init context vars + db.scope()
- [x] authMiddleware - BetterAuth + spoofing
- [x] rateLimit - Redis-based limiting
- [x] error handlers - 404, 500, 422

### Validations
- [x] validateUser - Auth guard

### Context Getters (lib/context)
- [x] getUser
- [x] getResource / getResourceType
- [x] getRequestId
- [x] isSuperadmin

### Request Templates
- [x] readRoute (single + many + paginate)
- [x] createRoute (single + many)
- [x] updateRoute
- [x] deleteRoute
- [x] actionRoute (with/without ID)

### Jobs
- [x] BullMQ worker with db.scope
- [x] Graceful shutdown
- [x] Type-safe job handlers (JobPayloads mapping)
- [x] makeJob, makeSingletonJob, makeSupersedingJob
- [x] Cron job registration from DB
- [x] Superseding job logic (cancel older jobs)
- [x] Admin cronJobs module (CRUD + trigger)
- [x] cleanupTestJobs utility
- [x] makeSupersedingJob tests

### Other
- [x] WebSocket support
- [x] Events system
- [x] Cache with Redis
- [x] S3 client
- [x] Stripe client
- [x] Logger with auto scope ID prefix

## Database (packages/db)

- [x] Prisma 7 with driver adapters
- [x] Split schema (multiple .prisma files)
- [x] Typed model IDs (phantom types)
- [x] Unified db client (db.txn, db.scope, db.raw, db.onCommit)
- [x] Mutation lifecycle hooks
- [x] Cache invalidation hook
- [x] Webhook delivery hook
- [x] Generated Zod schemas

## Auth

- [x] BetterAuth integration
- [x] Session management
- [x] Superadmin spoofing

## Docs

- [x] CLAUDE.md - AI dev guide
- [x] README.md
- [x] developer.md - Getting started
- [x] environments.md - Env setup
- [x] api-patterns.md - Route patterns
- [x] naming-conventions.md
- [x] RAW_NOTES.md - Unsorted notes
- [ ] architecture.md - System overview
- [ ] database.md - Schema & patterns
- [ ] auth.md - Auth flows
- [ ] testing.md - Test patterns
- [ ] deployment.md - Deploy guide

## Scripts

- [x] setup.sh - Initial setup
- [x] doppler-env.sh - Env sync

## TODO

- [ ] Fill doc stubs
- [ ] Tests for core utilities
- [ ] Playwright E2E
- [ ] Optional modules system
- [ ] Admin app
- [ ] UI package
