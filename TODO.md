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

Structure complete, needs implementation:

- [ ] Webhook delivery job - implement `sendWebhook` job handler (see Carde `runDeliverWebhookEvent.ts`)
- [ ] Webhook subscription matching - implement `checkForWebhookSubscriptions` using `WEBHOOK_SUBSCRIBERS`
- [ ] Add `WEBHOOKS_PRIVATE_KEY` env var for signing payloads
- [ ] WebhookSubscriptions module - CRUD routes for managing subscriptions (see Carde `/manage/webhooks/`)

## Cache (apps/api/src/hooks/cache/)

- [ ] Admin routes for clearing caches (pattern-based cache invalidation)
- [ ] Wire up `registerClearCacheHook` in app startup

## Events (apps/api/src/events/)

- [ ] Wire up event handlers in app startup (import `#/events/handlers/websocket`)

## Testing

- [ ] DB mutation lifecycle tests (registerDbHook, executeHooks)
- [ ] DB transaction tests (db.txn, db.onCommit, db.isInTxn)
- [ ] DB scope tests (db.scope, db.getScopeId)
- [ ] Webhook hook tests
- [ ] Cache hook tests
- [ ] Add Playwright for E2E testing
- [ ] Tests for request templates
- [ ] Tests for middleware

## Architecture

- [ ] Optional modules system (opt-in features like Stripe, S3, Sentry, etc.)
- [ ] I18n package (db + frontend)

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
