# API-003: Cursor (Keyset) Pagination Mode

**Status**: 🟡 Core landed — signing + integration tests outstanding
**Assignee**: TBD
**Priority**: Low
**Created**: 2026-07-30
**Updated**: 2026-09-03

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

- [x] Enforce total order: unconditionally append the primary key (UUIDv7) as final `orderBy` tiebreaker after `buildOrderBy` resolves
- [x] Seek instead of skip:
  - [x] Default: Prisma native `cursor: { id } + skip: 1 + take` (id tiebreaker mitigates the documented non-unique-orderBy footguns)
  - [x] Fallback for sorts Prisma's cursor mishandles: expand composite keyset into OR-chain where — `{ OR: [{ sortField: { lt: v } }, { sortField: v, id: { lt: lastId } }] }` — composed through the existing where pipeline (Prisma has no row-value comparison; accept the index-efficiency cost or `queryRaw` later)
- [x] Drop `count()`: fetch `take + 1`; extra row ⇒ `hasMore`, last kept row's sort-key values ⇒ next token
- [ ] Token contract: base64 of `{ sortKeyValues, orderByHash, filterHash }`, HMAC-signed
  - [ ] Reject token on orderBy/filter mismatch (400, not silent garbage) — cursors are only valid for the sort+filter they were minted under
  - [ ] Reject tampered/unsigned tokens

### Route templates / schemas

- [x] `cursorPaginateRequestSchema` (`limit`, `cursor?`) and response schema (`data`, `hasMore`, `nextCursor`) with OpenAPI registration
- [x] `readRoute({ pagination })` selects schema pair + executor; default stays `'offset'`

### Tests

- [ ] Stability: insert/delete rows mid-walk → no duplicates, no skips (the offset failure case as a regression test) — see Still open
- [x] Tiebreaker: non-unique sort field with same-value rows paginates without loss
- [ ] Token: mismatched orderBy/filter rejected; tampered signature rejected
- [ ] hasMore correctness at exact page boundaries
- [ ] Lens scoping + live scope apply identically in cursor mode (tenant isolation holds while paginating)

### Frontend

- [ ] Load-more / infinite-scroll primitive consuming `{ data, hasMore, nextCursor }` (numbered `Pagination.tsx` stays offset-only)

## Landed 2026-09-03 (ported from Zealot)

Zealot had already built this; the core is ported rather than written fresh. `apps/api/src/lib/prisma/keysetCursor.ts` (new), `cursorPaginate` + `withTotalOrder` in `paginate.ts`, cursor schemas in `paginationSchemas.ts`, and `paginate: true | 'cursor'` threaded through `types.ts` / `buildRequest.ts` / `buildResponses.ts` so `readRoute({ paginate: 'cursor' })` selects the schema pair.

Porting also pulled the shared composition out of `paginate` into `composeScopedFindMany`, so offset and cursor mode provably share lens binding resolution, search composition, authorization narrowing and live scope — the "reused unchanged" claim in Scope is now structural rather than a convention.

One deliberate deviation from the plan above:

- **Token is versioned base64url JSON, not HMAC-signed.** It carries `{v, k: sortChain, p: values}`, and `assertChainMatches` rejects a cursor whose chain differs from the resolved sort. That covers the orderBy-mismatch case but *not* the filter-mismatch case, and an unsigned token is client-forgeable — a caller can hand-craft a boundary value. It is not a privilege escalation (the lens where is composed server-side regardless), but it is not the contract this ticket specified. Signing + `filterHash` remain open below.

`withTotalOrder` derives the keyset anchor from prismaMap (the model's single `isId && isRequired` field) rather than assuming a column name, and refuses composite primary keys with a message telling the caller to pin the chain via `options.orderBy`. Zealot's copy hardcodes a `uuid` fallback on purpose - its legacy models carry integer `@id` columns that v2 routes must not sort on - so that difference stays.

Tests: `keysetCursor.test.ts` covers round-tripping, Date/BigInt serialization, and every rejection path (bad version, malformed, count mismatch, null, non-scalar, duplicate key), plus `assertChainMatches` and the composite OR-chain expansion of `buildKeysetWhere`. 17 tests. Suite: 997 pass / 2 fail, the two being pre-existing `lensWhere` count-operator failures on main.

## Still open

- [ ] HMAC-sign the token and add `filterHash`; reject a cursor minted under a different filter (currently only the sort chain is validated)
- [ ] Integration tests against a real delegate: `hasMore` at exact page boundaries; mid-walk insert/delete stability (the offset failure case); lens scoping + live scope hold identically in cursor mode
- [ ] One real route serving cursor mode end-to-end (nothing sets `paginate: 'cursor'` yet)
- [ ] FE load-more / infinite-scroll primitive

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

