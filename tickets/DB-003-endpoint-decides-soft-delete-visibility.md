# DB-003: The endpoint decides soft-delete visibility, not the actor

**Status**: 👀 Review
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

## History — why the hand-scoping existed

| Date | Commit | What |
|---|---|---|
| 2026-07-09 | `aa218581` | `resourceContextMiddleware` appends `deletedAt: null` for non-superadmins |
| 2026-07-09 | `3125e22f`, `b9a516e8` | lens traversal / `paginate` inject the live scope (non-superadmin) |
| 2026-07-10 | `bfd5c644`, `fea08cbf` | the injection becomes `liveWhere` / `liveIncludes` in `lib/prisma/softDeleteScope.ts` |
| 2026-08-23 | `b3d6f3cf` | the Prisma extension lands, *reusing* those two functions through an IoC scoper registry, with `db.withDeleted` and the `platformSuperadmin` bypass. Same commit adds `liveScopePlan` to `lensWhere` |

The hand-applied calls predate the extension; nothing was added after it for a reason of its own.
They survived because the API test harness never registered the scoper (`registerHooks` runs in
`index.ts` / `worker.ts` only; tests opted in per file), so route tests only saw soft-delete scoping
through the hand-applied layer. `lensWhere`'s count-plan scoping, added in the extension's own
commit, is tested by a file that never registered the scoper either. In production every one of
those positions was scoped twice.

`withDeleted` did not grow out of the helpers: it was born with the extension. The helpers became
the extension's implementation and stay as that — they lose every other caller.

## Change

- **The declaration is mounting on `adminRouter`.** `validateSuperadmin` (mounted only there,
  router-level, so it wraps the route's whole chain including `resourceContextMiddleware`) runs
  `next()` inside `db.withDeleted` once the check passes. No new middleware, no route option.
- **One scoping layer.** `resourceContextMiddleware`, `paginate` and `lensWhere` stop applying
  `liveWhere` / `liveIncludes` by hand and drop their superadmin branches; the extension scopes the
  lookup, the composed where, include/select trees and the count-plan `groupBy`s.
- **The extension gains `_count`.** `liveIncludes` passed `_count` through untouched, so relation
  counts included tombstones under either layer. It now scopes `_count: { select }` and expands
  `_count: true`.
- **The engine moves into `packages/db`.** `softDeleteScope.ts` sits beside the extension, which
  imports it directly; `whereWalker` and `fieldMetadata` move to `packages/db/src/utils` and export
  from `@template/db`. The IoC scoper registry goes: the extension is not a hook, the client composes
  it (`.$extends(softDeleteScopeExtension())`), and it is always on — nothing to register.
  `fieldMetadata` returns prisma-map's `ModelField`; its own `modelNames()` goes for the existing
  `modelNames` / `isModelName`.
- **Tests run what production runs.** The extension is always on; the per-file
  register/unregister pairs go, and tests that inspect tombstones read through `db.withDeleted`.
- **Drop `platformSuperadmin` from `AuditActor`.** Its sole reader was the extension's bypass.
- **Docs**: `docs/claude/CONTEXT.md`, `DATABASE.md`, `HOOKS.md`, `API_ROUTES.md`, `PERMISSIONS.md`.

## Follow-ups

- `paginate`'s `skipFieldValidation: superadmin` (searchable-field whitelist) is still keyed on the
  actor, though `buildRequest` describes it as an *admin-route* behaviour — candidate for the same
  treatment.
- `adminUserRouter` (`modules/user`, `adminUserRedact`) is built by `autoRegisterAdminRoutes` and
  tested at `/api/admin/user` but never mounted on `adminRouter`, so it is unreachable in the app.
- The extension still decides from ALS inside a Prisma extension callback — the pattern DB-001
  retires for transaction identity. This rides the existing `db.withDeleted` mechanism and adds no
  new ALS read.

## Tests

- The real `adminRouter` (`routes/admin.test.ts`): a non-superadmin gets 403 for a missing id, a
  malformed id and a real id — the superadmin check runs before `resourceContextMiddleware` and the
  param validator; a superadmin resolves the id. The list route's `deleted` switch decides tombstone
  visibility. Mutation-checked: registering the guard after the routes fails all three 403 cases.
- Extension in `packages/db`, with no API wiring: scopes every read and write.
- Superadmin on a normal route → 404 on a soft-deleted resource.
- Superadmin on a `validateSuperadmin` router → resolves it.
- Non-superadmin on that router → 403.
- Extension coverage, DB-backed, with no hand-scoping anywhere: root where, relation filters
  (`some`), nested include and select trees, `_count`, `count`, `groupBy`, explicit `deletedAt`
  opt-out at root and include level, writes, `withDeleted`.
