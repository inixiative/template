# DB-005: A route can opt into soft-deleted rows, and the caller asks per request

**Status**: ✅ Done
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-10-14
**Updated**: 2026-10-14
**Related**: DB-003, ZLT-5486 (Zealot mirror)

---

## Ruling (Aron, 2026-10-14)

DB-003 made soft-delete visibility the endpoint's decision: superadmin endpoints see tombstones and
every other route is scoped for everyone. Some ordinary routes still have to reach a tombstone. In
Zealot that's a banned member's page, which has to open so the admin can unban or erase them. Two
gates, both required:

- The route declares `includeDeleted: true` on its template (any template: read, create, update,
  delete, action). Revive endpoints have to load the tombstone they revive, so writes may declare it.
  Apply it judiciously.
- The caller passes `?includeDeleted=true` on each request.

## Change

- `RouteArgs.includeDeleted`. `buildRequest` merges an `includeDeleted` query param
  (`'true' | 'false'`) into the route's query schema, so it is in the spec and the SDK.
- `includeDeletedMiddleware` runs everything after it inside `db.withDeleted` when the caller asks.
  `prepareMiddleware` puts it first in the route chain, before `resourceContextMiddleware`.
  Authentication runs at app level, before the route chain, so it never runs unscoped.
- The unlock covers the whole request, not only the lookup. A soft-delete cascade stamps the
  parent's `deletedAt` onto its children, so a lookup-only unlock loads the target without them.
- `withDeleted` / `withSoftDeleteScope` nest and run in parallel safely (AsyncLocalStorage per
  callback; an inner call returning restores the outer value), so a superadmin endpoint that also
  declares the flag gets no double effect.

## Tests

`resourceContextMiddleware.test.ts`:
- a declaring read 404s a tombstone unless asked, and `?includeDeleted=false` stays scoped;
- a route that doesn't declare it ignores the param;
- a declaring update revives its tombstone.

The two positive tests fail with the middleware unwired.
