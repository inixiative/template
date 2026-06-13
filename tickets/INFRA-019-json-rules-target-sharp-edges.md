# INFRA-019: json-rules target-compilation sharp edges

**Status**: 🆕 Backlog (not blocking)
**Assignee**: TBD
**Priority**: Low
**Created**: 2026-06-13
**Updated**: 2026-06-13

---

## Overview

`@inixiative/json-rules` is "one AST, three targets" (`check` / `toPrisma` /
`toSql`) — but the targets are **not symmetric**. A set of operators and rule
shapes evaluate correctly in-memory with `check()` yet cannot compile to Prisma
and/or SQL; some throw a clear "unsupported" error, others are documented as
`check()`-only. This is deliberate and **already documented + test-covered**;
this ticket exists so the remaining edges are tracked in one place and can be
closed over time rather than rediscovered per-consumer.

These edges are introspectable today: `describeRule(rule, lens).supportedTargets`
reports which of `check`/`toPrisma`/`toSql` a given rule can actually use, so a
consumer (rules builder, filters, permissions) can surface "this rule is
check-only" instead of hitting a runtime throw.

## The edges (with backing tests)

All references are in the `@inixiative/json-rules` repo.

### Prisma (`toPrisma`) — README §"Prisma Limitations"

- `matches` / `notMatches` (regex) — not supported. (`test/toPrisma.test.ts`)
- `dayIn` / `dayNotIn` — not supported. (`test/toPrisma.test.ts`)
- `path: '$.field'` column-to-column comparisons — not supported in a Prisma
  `WHERE`. (`test/toPrisma.test.ts`)
- aggregate rules with `notBetween` — not supported. (`test/aggregate.test.ts`)
- aggregate rules over JSON / native-stored arrays — not supported; use `toSql()`
  or `check()`. (`test/aggregate.test.ts`, `test/toSql.mapaware.test.ts`)

### SQL (`toSql`) — README §"SQL Limitations"

- array-quantifier element operators `all` / `any` / `none` / `atLeast` — not
  supported in SQL output. (`test/toSql.test.ts`, `test/array-operations.test.ts`)
- windowing (`orderBy` / `take` / `skip`) — `toSql()` does not compile windowing
  at all (no relation subqueries in a `WHERE` fragment).
  (`test/windowing.compile.test.ts`)

### Windowing + filter (both compiled targets)

- ordered windowing (first/last `N` via `orderBy`/`take`/`skip`) is **`check`-only**;
  `toPrisma` only handles the monotonic extremal rewrite and **throws** on a
  non-monotonic condition, a misaligned direction, or a stray `orderBy`.
  (`test/windowing.compile.test.ts`, `test/windowing.test.ts`)
- the pre-window `filter` stage (2.7.0) runs fully in `check()`; `toPrisma` /
  `toSql` **throw**. (`test/windowing.compile.test.ts`)

### Root-array rules

- root-array compilation to Prisma/SQL is **not implemented** — these rules are
  `check()`-only. (`test/check.rootArray.test.ts`)

## Not a bug (expected contracts, listed to avoid re-filing)

- Relative/calendar date expressions require an explicit `now` input; `check` /
  `toPrisma` / `toSql` throw if one is used without `now` (no implicit
  `Date.now()`).
- count/aggregate relation operators require `{ map, model }` context.

## Possible work (when prioritized)

- Close specific gaps where a real consumer needs the compiled target (e.g. SQL
  array quantifiers via `EXISTS`/lateral joins; windowing via subqueries).
- Until then, ensure every consumer routes through `describeRule.supportedTargets`
  so an unsupported rule degrades to `check()` (or is rejected at author time)
  rather than throwing at execution.

## Related Tickets

- Related: INFRA-002 (rules builder — should surface `supportedTargets` in the
  editor), INFRA-017 (builder surface — `describeRule` is the introspection point)
