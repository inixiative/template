# TODO

## Tests & Type Errors

All tests passing (230 total: 151 API + 79 DB).

### Type Errors to Fix
- [x] Implicit `any` types in webhooks/sendWebhook/redactUser
- [x] Redis `EX` typing in auth.ts (use setex)
- [x] adminCacheClear route/controller body schema mismatch
- [ ] packages/db circular type refs (pre-existing, low priority)

### Low Priority (not blocking)
- [ ] Inquiry module - needs fake polymorphism refactor (sourceId/targetId → sourceUserId/etc)
- [ ] adminInquiryReadMany query type/status enum typing

### Missing Deps (stub or install when needed)
- [ ] `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` - for S3 file uploads
- [ ] `stripe` - for payments

## Polish & Documentation

- [ ] Polish CLAUDE.md and AI instructions
- [ ] Polish CI/CD scripts and tooling
- [ ] Documentation: architecture.md, database.md, api-patterns.md, auth.md, testing.md, deployment.md

## Features

### Webhooks ✓
- [x] Webhook delivery job with RSA-SHA256 signing
- [x] Webhook hook triggers on db mutations
- [x] WebhookSubscriptions CRUD + create via /me and /organization
- [x] Circuit breaker (disables after 5 consecutive failures)
- [x] Tests for sendWebhook handler

### Cache ✓
- [x] Cache invalidation hook (`registerClearCacheHook`)
- [x] Admin routes for clearing caches

### DB Hooks ✓
- [x] mutationLifeCycle extension
- [x] falsePolymorphism registry → auto-generates rules + immutable fields
- [x] immutableFields hook (infers FKs from relations)
- [x] rules hook (declarative validation)

## Future Work

### Events
- [ ] Wire up WebSocket event handlers

### Architecture
- [ ] Optional modules system (opt-in features like Stripe, S3, Sentry)
- [ ] I18n package (db + frontend)

## Developer Experience

- [ ] Init script for new forks (`bun run init`)
  - Rename packages `@template/*` → `@projectname/*`
  - Generate secrets (BETTER_AUTH_SECRET, WEBHOOK_SIGNING_KEYS)
  - Create .env files from .env.*.example
  - Run db migrations and generate Prisma client
  - Update CLAUDE.md with project-specific context

## Mutation Lifecycle Hooks

- [ ] Transaction timeout estimation for `updateManyAndReturn`
  - Auto-wrapped in transaction, but large bulk updates may timeout
  - Calculate record count in before hook, adjust timeout accordingly
- [ ] Handle Prisma comparative operators in rules validation
  - `increment`, `decrement`, `multiply`, `set` operators don't merge properly with previous state
  - Merged data sees `{ count: { increment: 1 } }` instead of resulting value
  - Document limitation or add special handling for atomic operations
- [ ] Batching for large recordsets in hooks
  - resolveAll runs callbacks in parallel but blocks until all complete
  - Very large bulk operations could cause memory/timeout issues
  - Consider chunked processing or streaming for 1000+ records

### Apps
- [ ] Build out admin app UI
- [ ] Build out superadmin app UI

### Testing
- [ ] Add Playwright for E2E testing
