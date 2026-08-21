# FE-006: Conditional Form v2 — form/filter surface on json-rules

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-08-21
**Updated**: 2026-08-21

---

## Overview

A new major version of [`inixiative/conditional-form`](https://github.com/inixiative/conditional-form) (paused July 2025 — predates json-rules 2.x and rules-builder) as the real conditional form surface: dynamic form generation with conditional field logic, and generic in-memory filtering of loaded collections, where every predicate is a real json-rules Condition — authored through rules-builder, validated at save (`checkRuleAgainstLens`), evaluated by `check()` / `useFilteredCollection`. Never a parallel predicate dialect.

## Boundary ruling (2026-08-21, Aron — from Zealot UE-4174)

- **Bracket query stays a pure proxy to Prisma.** Grouping/combinators in the query string use Prisma's own vocabulary (reserved `[AND][i]`/`[OR][i]` indexed nodes, nestable like Prisma's where — see UE-4174). json-rules is a separate system and is never serialized into the query string.
- **Generic FE in-memory evaluation belongs here, on json-rules** — not in a second bracket-shape evaluator. [FE-004](./FE-004-in-memory-filter-evaluator.md)'s `applyFilters` sketch (full bracket-operator-parity evaluator over `FilterState`) should be re-judged against this project before being built.
- **Hand-rolled per-surface FE filters are a sanctioned stopgap** until this lands (e.g. Zealot's references-kanban fuzzy note-search, `referencesFilterMatch`).

## What already exists

- `useFilteredCollection` shipped in rules-builder 0.16.0+ (json-rules `check()` with `engineGlobals.with({ string: { fuzzy, caseInsensitive } })` baked in) — currently unconsumed by both the template and Zealot.
- json-rules 2.16+ carries the string-match parity primitives (`caseInsensitive`, `fuzzy` — `check()`-only, `toPrisma`/`toSql` throw on fuzzy).
- The old conditional-form repo's concept (fields shown/hidden/required by conditions over the form's own draft state) is the seed; its implementation is not — rewrite, don't revive.

## Scope sketch

- Conditional form generation: field visibility/requiredness driven by Conditions over the form's draft state, lens-aware.
- The filter-form face: flat `FilterState`/saved-view snapshots translate to Conditions for in-memory evaluation (they're deliberately Condition-translatable — flat AND-only `{fieldPath: {operator, values}}`).
- Drop-in replacement path for bespoke per-surface `filterX` utils, superseding that goal of FE-004.

## Related

- [INFRA-002: rules-builder](./INFRA-002-rules-builder.md)
- [FE-003: schema-driven filter helpers](./FE-003-schema-driven-filter-helpers.md)
- [FE-004: in-memory filter evaluator](./FE-004-in-memory-filter-evaluator.md)
- [INFRA-017: builder surface](./INFRA-017-builder-surface.md)
