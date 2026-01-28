# TODO

## Immediate Type Errors

- [ ] Missing npm deps - stub or install `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `stripe`
- [ ] Auth middleware - Better-Auth session typing issues in `authMiddleware.ts`
- [ ] Inquiry controllers - add user null checks (routes should have auth middleware)
- [ ] Inquiry module - update to fake polymorphism (sourceId/targetId → sourceUserId/sourceOrganizationId etc)
- [ ] Inquiry resolution service - update to use fake polymorphism fields
- [ ] Route templates - fix `createRoute` export in `#/lib/requestTemplates/create`
- [ ] Test files - delete or fix stale auth tests (reference deleted auth module)
- [ ] adminInquiriesReadMany - query schema missing type/status fields
- [ ] cronJobsCreate route - createRoute not exported

## Webhooks (apps/api/src/hooks/webhooks/)

- [x] Webhook delivery job - `sendWebhook` handler with RSA-SHA256 signing
- [x] Webhook hook - `registerWebhookHook` triggers on db mutations
- [x] `WEBHOOK_SIGNING_PRIVATE_KEY` env var for signing payloads
- [x] WebhookSubscriptions module - CRUD routes + create via /me and /organization
- [x] Circuit breaker - disables subscription after 5 consecutive failures
- [x] Tests for sendWebhook handler

## Cache (apps/api/src/hooks/cache/)

- [x] Wire up `registerClearCacheHook` in app startup (via `registerHooks()`)
- [x] Admin routes for clearing caches (`POST /api/admin/cache/clear`)

## Events (apps/api/src/events/)

- [ ] Wire up event handlers in app startup (import `#/events/handlers/websocket`)

## Testing

- [ ] DB mutation lifecycle tests (registerDbHook, executeHooks)
- [ ] DB transaction tests (db.txn, db.onCommit, db.isInTxn)
- [ ] DB scope tests (db.scope, db.getScopeId)
- [x] Webhook handler tests (sendWebhook with circuit breaker)
- [x] Webhook route tests (CRUD, create via /me and /organization)
- [ ] Cache hook tests
- [ ] Add Playwright for E2E testing
- [ ] Tests for request templates
- [ ] Tests for middleware

## Architecture

- [ ] Optional modules system (opt-in features like Stripe, S3, Sentry, etc.)
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

## Apps

- [ ] Create admin app
- [ ] Create superadmin app

## Cleanup

- [ ] Review and remove `.tmp` files in apps/api/src/
- [ ] Review untracked files from git status

## Documentation

- [ ] architecture.md
- [ ] database.md
- [ ] api-patterns.md
- [ ] auth.md
- [ ] testing.md
- [ ] deployment.md
