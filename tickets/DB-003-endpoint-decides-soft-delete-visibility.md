# DB-003: The endpoint decides soft-delete visibility, not the actor

**Status**: 🚧 In Progress
**Assignee**: Aron
**Priority**: High
**Created**: 2026-10-10
**Updated**: 2026-10-10
**Related**: ZLT-5486 (Zealot mirror)

---

## Ruling (Aron, 2026-10-10)

Soft-delete visibility is decided by the **endpoint**, not the actor. Declared superadmin endpoints
run fully unlocked: they read and write tombstones, and they are specific on purpose — typically
fewer guards and less tenancy. Every other endpoint is soft-delete scoped for everyone, including a
superadmin calling it.

## Today: three actor-keyed bypasses

A superadmin calling any route sees tombstones, because each layer asks "is the caller a superadmin?":

| Where | Branch |
|---|---|
| `packages/db/src/extensions/softDeleteScopeExtension.ts` `bypassed()` | `scope.platformSuperadmin \|\| scope.bypassSoftDeleteScope` |
| `apps/api/src/middleware/auth/auditActorMiddleware.ts` | stamps `platformSuperadmin: isSuperadmin(c)` on the ALS actor for every request — the only reason the field exists |
| `apps/api/src/middleware/resources/resourceContextMiddleware.ts` | skips `liveWhere` / `liveIncludes` when `isSuperadmin(c)` — a superadmin resolves a tombstoned `:id` on any resource route |
| `apps/api/src/lib/prisma/paginate.ts` `composeScopedFindMany` | skips `liveWhere` / `liveIncludes` when `isSuperadmin(c)` |

The endpoint-based surface already exists and is not what decides it: `apps/api/src/routes/admin.ts`
mounts every admin router behind `validateSuperadmin`.

## Change

- **The declaration is mounting on `adminRouter`.** Replace `adminRouter.use('*', validateSuperadmin)`
  with one `superadminEndpoint` middleware that runs `validateSuperadmin` and then `next()` inside
  `db.withDeleted`. Guard and unlock are one declaration, so a router can't be unlocked without the guard.
  No route-template option is needed: router middleware wraps the route's own middleware chain, so
  `resourceContextMiddleware` and the controller already run inside the bypass.
- **One flag decides it.** The extension, `resourceContextMiddleware` and `paginate` all read the
  ALS `bypassSoftDeleteScope` flag (`auditActorContext.isSoftDeleteBypassed()`) — the same flag
  `db.withDeleted` sets. The `isSuperadmin(c)` branches go.
- **Drop `platformSuperadmin` from `AuditActor`.** Its sole reader was the extension's bypass; an
  unread actor fact is an invitation to key visibility on the actor again.
- **Docs**: `docs/claude/CONTEXT.md`, `DATABASE.md`, `HOOKS.md`, `API_ROUTES.md`.

## Not in scope

- `paginate`'s `skipFieldValidation: superadmin` (searchable-field whitelist) stays actor-keyed. It is
  not soft-delete, though `buildRequest` describes it as an *admin-route* behaviour — candidate for the
  same treatment.
- `adminUserRouter` (`modules/user`, `adminUserRedact`) is built by `autoRegisterAdminRoutes` and
  tested at `/api/admin/user` but never mounted on `adminRouter`, so it is unreachable in the app.
- The extension still decides from ALS inside a Prisma extension callback — the pattern DB-001
  retires for transaction identity. This ticket rides that existing `db.withDeleted` mechanism; it
  doesn't add a new ALS read.

## Tests

- Superadmin on a normal route → 404 on a soft-deleted resource.
- Superadmin on a `superadminEndpoint` route → resolves it.
- Non-superadmin on a `superadminEndpoint` route → 403.
