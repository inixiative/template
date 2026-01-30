# TODO

## In Progress

- [ ] Fix failing tests (16 failing, 3 errors in last run)

## Type Errors

- [x] Implicit `any` types in webhooks/sendWebhook/redactUser
- [x] Redis `EX` typing in auth.ts
- [x] adminCacheClear route/controller body schema mismatch
- [ ] packages/db circular type refs (pre-existing, low priority)

## Low Priority

- [ ] Inquiry module - needs fake polymorphism refactor (sourceId/targetId → sourceUserId/etc)

## Missing Deps (install when needed)

- [ ] `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` - S3 file uploads
- [ ] `stripe` - payments

## Future Work

### Mutation Lifecycle

- [ ] Transaction timeout estimation for `updateManyAndReturn`
- [ ] Handle Prisma comparative operators (increment, decrement) in rules validation
- [ ] Batching for large recordsets in hooks

### Features

- [ ] Wire up WebSocket event handlers
- [ ] Optional modules system (opt-in features)
- [ ] I18n package

### Database

- [ ] Wire constraint helpers into db lifecycle (local setup + CI/CD) if using them

### Developer Experience

- [ ] Init script for new forks (`bun run init`) - should configure Doppler
- [ ] Localtunnel helper for webhook testing (ref: Carde)
- [ ] Build out admin/superadmin app UIs
- [ ] Add Playwright for E2E testing (`tests/e2e/`)
- [ ] Add Artillery for load testing (`tests/load/`)



NOTES w/ Hernan
audit/activity logs
mermaid for markdown
pen test? - autonoma
lets set default orderby in paginate
both auths are token (JWT) -docs (session is cookies?)
look into turbo repo (w/ bun) to skip unchanged tests
optimisitic updates in tanstack query
- when you change data, change the cache of the data before the real trigger/invalidate
- 
