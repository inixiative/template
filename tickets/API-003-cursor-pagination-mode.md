# API-003: Cursor (Keyset) Pagination Mode

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: Low
**Created**: 2026-07-30
**Updated**: 2026-07-30

---

## Overview

Add an opt-in cursor/keyset pagination mode alongside the existing offset `paginate` for unbounded list surfaces (feeds, activity/audit logs, exports, public API consumers that only walk forward). Offset pagination stays the default — it is the right tool for admin tables, jump-to-page-N, and totals.

Motivation: offset pagination drifts under concurrent writes (rows skipped/duplicated when inserts land ahead of the offset), pays a full `count()` on every request, and degrades linearly with depth (`OFFSET n` reads and discards n rows). Keyset seeks directly to the last-seen position via an index range scan: O(pageSize) at any depth, stable under writes, no count.

Trade-off accepted: cursor mode has no random access (no jump to page N, no totalPages). Jump-to-end is served by flipping the sort direction; jump-to-semantic-position by range filters.

## Scope

- New `paginateCursor` (or `mode: 'cursor'` option on `paginate`) in `apps/api/src/lib/prisma/`
- `readRoute({ pagination: 'offset' | 'cursor' })` selection in routeTemplates, with schema pair per mode
- Signed opaque cursor token contract
- Load-more/infinite-scroll UI primitive counterpart to `Pagination.tsx` (may split to an FE ticket)

**Reused unchanged** (the fork is only the tail of `paginate`): lens declaration/binding resolution, `buildWhereClause` search composition, `liveWhere`/`liveIncludes` soft-delete scoping, superadmin bypass, `buildOrderBy`.

## Tasks

### Core

- [ ] Enforce total order: unconditionally append the primary key (UUIDv7) as final `orderBy` tiebreaker after `buildOrderBy` resolves
- [ ] Seek instead of skip:
  - [ ] Default: Prisma native `cursor: { id } + skip: 1 + take` (id tiebreaker mitigates the documented non-unique-orderBy footguns)
  - [ ] Fallback for sorts Prisma's cursor mishandles: expand composite keyset into OR-chain where — `{ OR: [{ sortField: { lt: v } }, { sortField: v, id: { lt: lastId } }] }` — composed through the existing where pipeline (Prisma has no row-value comparison; accept the index-efficiency cost or `queryRaw` later)
- [ ] Drop `count()`: fetch `take + 1`; extra row ⇒ `hasMore`, last kept row's sort-key values ⇒ next token
- [ ] Token contract: base64 of `{ sortKeyValues, orderByHash, filterHash }`, HMAC-signed
  - [ ] Reject token on orderBy/filter mismatch (400, not silent garbage) — cursors are only valid for the sort+filter they were minted under
  - [ ] Reject tampered/unsigned tokens

### Route templates / schemas

- [ ] `cursorPaginateRequestSchema` (`limit`, `cursor?`) and response schema (`data`, `hasMore`, `nextCursor`) with OpenAPI registration
- [ ] `readRoute({ pagination })` selects schema pair + executor; default stays `'offset'`

### Tests

- [ ] Stability: insert/delete rows mid-walk → no duplicates, no skips (the offset failure case as a regression test)
- [ ] Tiebreaker: non-unique sort field with same-value rows paginates without loss
- [ ] Token: mismatched orderBy/filter rejected; tampered signature rejected
- [ ] hasMore correctness at exact page boundaries
- [ ] Lens scoping + live scope apply identically in cursor mode (tenant isolation holds while paginating)

### Frontend

- [ ] Load-more / infinite-scroll primitive consuming `{ data, hasMore, nextCursor }` (numbered `Pagination.tsx` stays offset-only)

## Open Questions

- Separate `paginateCursor` export vs `mode` option on `paginate`? (Return types differ; separate function is probably honest.)
- Where does the HMAC secret live — reuse existing app secret or dedicated key?
- Do we expose `prevCursor` (requires reverse-seek + flip) or forward-only for v1? (Lean: forward-only.)
- `queryRaw` row-value comparison (`WHERE (a, id) < ($1, $2)`) as an optimization pass if OR-chain plans poorly on large tables?

## Definition of Done

- [ ] One real route serves cursor mode end-to-end with OpenAPI docs
- [ ] Mid-walk-write stability test passes (offset equivalent demonstrably fails it)
- [ ] No `count()` issued in cursor mode
- [ ] Token invalidation semantics documented with examples

## Resources

- Motivating comparison: Stripe `starting_after`, GitHub/AWS cursor APIs — opaque tokens decouple clients from pagination internals (page size, partitioning, engine changes)
- Prisma cursor pagination docs (unique-cursor requirement + orderBy caveats)

## Related Tickets

- FEAT-017 (audit log explorer — textbook cursor consumer: unbounded, forward-walking)
- INFRA-020 (audit cold storage — export walks)
- FE-003 (schema-driven filter helpers — filterHash interplay)

