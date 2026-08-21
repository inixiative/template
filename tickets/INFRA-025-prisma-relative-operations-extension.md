# INFRA-025: Prisma kernel extension — compile json-rules' relative operators to make non-bridge prefilters exact (enable pagination)

**Status**: 🆕 Not Started — problem framing + direction; mechanism not chosen.
**Assignee**: Aron
**Priority**: Medium (depth investment; unlocks pagination on relative-operator lenses)
**Created**: 2026-07-02
**Updated**: 2026-07-02

json-rules compiles one rule to three backends: `check()` (in-memory, authoritative — handles everything the algebra can express), `toSql()`, and `toPrisma()` (query **prefilters**). The pipeline is two-phase: compose the rule as a prefilter query, run it, then re-run the full rule in memory with `check()` as the authoritative filter. **The prefilter is best-effort and is never trusted alone** — an overmatching prefilter is correct by construction, because `check()` always post-filters. So overmatch is not a bug; it is the design. This ticket is not about correctness.

## What overmatch actually costs

Two things, neither of them correctness:

1. **Over-fetch** — a loose prefilter hands more rows to `check()` than necessary. Wasted IO + in-memory evaluation, felt at scale.
2. **Pagination** — you cannot paginate a prefilter whose result set `check()` will thin: page N of the query ≠ page N of the post-checked rows, so page boundaries are unstable. **An exact prefilter is paginatable; an overmatching one is not.** This is the main motivation.

## Where the prefilter overmatches, and whether we care

- **Bridged (cross-map) lenses** — inherently overmatch; a cross-map hop can't be fully expressed in a single Prisma query. Pagination on a bridged lens is impossible regardless of this ticket. **Accept the overmatch, post-check, move on.** Not in scope to make exact.
- **Non-bridge lenses with relative operators** — this is the opportunity. Prisma's `where` compares a field to a **literal**; it can't express operators that relate a field to *another field, an aggregate, or a relative value*:
  - **Field-to-field comparison** — json-rules' right-side `path:` refs (`{ field: 'startsAt', operator: lessThan, path: 'endsAt' }`, or a related record's column).
  - **Relative date math** — a field vs. `now`/another field ± interval, timezone-anchored (see json-rules date exprs / INFRA-023 binds).
  - **Aggregate / count conditions** — count/sum/avg over a *filtered* relation vs. a value; Prisma's `_count` / `some|every|none` cover only a slice.

  On these, `toPrisma` today drops the predicate to `check()`, so the prefilter overmatches — and often the relative operator is the **only** thing forcing it. Compile those to the query layer and the non-bridge prefilter becomes **exact**, which eliminates the over-fetch **and unlocks pagination** for that lens. That is the whole point.

## Driving example

A lens over Events scoped to "rows where `startsAt < endsAt`", or a list "inquiries whose `assignee.orgId` equals the record's `orgId`" — no bridge, one relative (field-to-field) predicate. Today it overmatches on that predicate → `check()` post-filters → the list can't be paginated. Compile the field-to-field comparison into the query and the prefilter is exact → paginatable, and `check()` has nothing left to thin.

## Direction

A **Prisma client extension** (kernel-level, in `packages/db`) that teaches the query layer the relative operations Prisma's `where` lacks — most likely by lowering the relative predicates to a raw SQL fragment (`$queryRaw` / a CTE / an `AND`-ed condition), resolving column identities through **`prismaMap`** so it stays schema-agnostic (the same convention the factory system and lens layer already lean on). This is a **coordinated** change: json-rules' `toPrisma` emits a portable IR for the relative predicates (rather than degrading), and the db-layer extension executes it. json-rules keeps compiling, never connecting — it *describes*, the extension *executes*. A real lift: Prisma extensions can't drop arbitrary SQL into a `findMany` where, so the shape is probably "base `where` via Prisma ∧ relative predicates resolved by the extension," not a single query object.

## Open questions

1. **Boundary** — json-rules `toPrisma` emits the relative-op IR; a thin `packages/db` executor runs it. Keep json-rules ORM-free.
2. **Mechanism** — client-extension custom op vs. `$queryRaw`-composed CTE vs. two-step (Prisma base query ∧ raw id-filter). Which stays *exact* (so the result is genuinely paginatable) and composes with the lens `where` injection, `orderBy`, and `LIMIT/OFFSET`?
3. **Exactness is the acceptance bar** — the whole value is pagination, so a compiled predicate has to be *exact*, not merely tighter. If a given relative op can only be tightened (not made exact), it stays a `check()`-post-filter and the lens stays non-paginatable — that's fine, just be explicit about which ops reach exact.
4. **Scope order** — field-to-field comparison first (most common blocker, unblocks the driving cases). Aggregate/count and relative-date next.
5. **Proof** — pair with the cross-backend equivalence suite (a shared fixture matrix asserting `check()` == `toPrisma+extension` on the compiled ops). Exactness is a claim until a suite proves it.

## Not in scope

- **Making bridged lenses exact** — they inherently overmatch; pagination there is impossible regardless. Accept + post-check.
- The `check()` backend — stays the authoritative post-filter; this tightens the *prefilter*, it doesn't replace check().
- Full `toSql` (raw Postgres) parity — related, separate axis.
- Choosing the final mechanism — becomes a json-rules `FEAT-*` (IR) + a `packages/db` extension once a direction is picked.

## Related

- **json-rules** — `toPrisma` compiler and the two-phase prefilter+check contract.
- **INFRA-023** — serializable dynamic `where` / context binds (relative-to-context values resolve before compilation).
- **INFRA-024** — richer source option sets (another consumer of complete Prisma compilation).
- **Cross-backend equivalence suite** (recommended in the 2026-07 ecosystem review) — the proof harness exactness needs.
