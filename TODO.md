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
- [x] falsePolymorphism hook
- [x] immutableFields hook
- [x] rules hook (declarative validation)

## Future Work

### Events
- [ ] Wire up WebSocket event handlers

### Architecture
- [ ] Optional modules system (opt-in features like Stripe, S3, Sentry)
- [ ] I18n package (db + frontend)

### Apps
- [ ] Build out admin app UI
- [ ] Build out superadmin app UI

### Testing
- [ ] Add Playwright for E2E testing
