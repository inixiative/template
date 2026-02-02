# TODO

## In Progress

- [x] Token permission tests - comprehensive tests for OrganizationUser and SpaceUser tokens
- [x] setupSpacePermissions - space-level permission setup mirroring org pattern

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

### Audit/Activity Logs

Schema design for tracking all mutations:

```prisma
model AuditLog {
  id          String   @id @default(dbgenerated("uuidv7()"))
  createdAt   DateTime @default(now())

  // Who
  userId      String?
  tokenId     String?
  ipAddress   String?
  userAgent   String?

  // What
  action      String   // 'create' | 'update' | 'delete'
  model       String   // 'User', 'Organization', etc.
  recordId    String

  // Changes
  before      Json?    // Previous state (for update/delete)
  after       Json?    // New state (for create/update)
  changes     Json?    // Diff of changed fields

  @@index([userId])
  @@index([model, recordId])
  @@index([createdAt])
}
```

Implementation:
- Hook into mutation lifecycle (after hook)
- Filter sensitive fields from logs
- Consider async write to avoid latency
- Retention policy (30/90 days?)

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
DionyzRex was referencing Django Admin - Django's automatic admin interface that generates CRUD UI directly from your model definitions. You define a Python model class, and
Django automatically creates forms, lists, filters, and search based on field types. It's the same concept: schema → generated UI.
