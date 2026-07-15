# FE-004: In-Memory Filter Evaluator

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-06-30
**Updated**: 2026-06-30

---

## Overview

A client-side filter that evaluates the **same predicate shape** as the server-side `where`-builder, in memory, over already-fetched data. The server compiles a filter definition to a Prisma `where`; the client should be able to run that identical definition as a `.filter()` over an array. One predicate language, two executors — SQL on the server, in-memory on the client.

This is the explicit non-goal of [FE-003](FE-003-schema-driven-filter-helpers.md) ("Client-side filtering — this is for server-side query construction"). FE-003 builds the *server query*; FE-004 evaluates the *same predicates* against rows the client already holds. They share the operator vocabulary (`@template/shared/bracketQuery`) and the per-field metadata (`FieldMetadata` / `DataConfig`).

## Motivation

Surfaces that have already loaded a full result set sometimes need a display-only narrowing the server can't make for them — e.g. a single endpoint feeding two surfaces with different display needs (a carousel showing only earned/featured rows vs. a full tab), or a sort/segment toggle that's purely presentational. Today each surface hand-rolls a bespoke `filterX` util that re-encodes row predicates in a different shape than the server's `where`, so the two drift.

> **Motivating case (Zealot):** `filterRewardsForCarousel` + a client sort on the rewards list (PR userevidence/Zealot-Monorepo#1546). The endpoint is paginated and server-owns visibility/scope/sold-out/order; the carousel still needs a display-only "earned level rewards only" narrowing for tier-status programs. That narrowing is the same `isLevelRewardEarned` predicate the server evaluates — it should be one definition the client runs in memory, not a parallel util.

## Objectives

- An in-memory evaluator that consumes the same `{ path, operator, values }` filter shape `buildWhereClause` consumes server-side
- Full operator parity with `@template/shared/bracketQuery` — scalar (`contains`, `equals`, `lt`, `lte`, `gt`, `gte`, `startsWith`, `endsWith`, `not`), array (`in`, `notIn`), relation (`some`, `every`, `none`, `is`, `isNot`)
- Relation-path traversal matching `buildRelationPath` (FE-003) — `tokens.some.name` evaluated against a nested array
- Derive the same `FieldMetadata` so a field's type drives coercion (date/number compares) exactly as the server does
- Drop-in for the bespoke per-surface `filterX` utils

## Conceptual model

This is the `toPrisma` ↔ in-memory-evaluate duality the rules/lens layer already expresses: a rule defined once, compiled to a Prisma `where` for the DB and checked in memory for the client (`checkRuleAgainstLens`). FE-004 is that duality for the `bracketQuery`/`DataConfig` filter shape rather than the lens tree — same principle, same goal of a single source of truth for "does this row match."

---

## Design (sketch)

### Core: `applyFilters(rows, filters, fields?)`

**File:** New `packages/ui/src/lib/applyFilters.ts`

```ts
import type { FilterState } from './buildFilterQuery';
import type { FieldMetadata } from './getFieldMetadata';

/**
 * Evaluate the same filter shape `buildWhereClause` compiles to a Prisma
 * `where`, but in memory over already-fetched rows. Field metadata (FE-003)
 * drives type-correct comparison (date/number) and relation traversal.
 */
export function applyFilters<T>(
  rows: T[],
  filters: Record<string, FilterState>,
  fields?: FieldMetadata[],
): T[];
```

### Operator evaluation: `matchesOperator(value, operator, target, type)`

**File:** New `packages/ui/src/lib/matchesOperator.ts`

One scalar/array operator → one predicate, mirroring the Prisma semantics `buildWhereClause` emits (case-insensitivity, null handling, date coercion). This is the table that must stay in lockstep with the backend operator set in `@template/shared/bracketQuery`.

### Relation paths

Reuse `buildRelationPath` (FE-003) for path construction; `applyFilters` walks `some`/`every`/`none`/`is`/`isNot` against nested arrays/objects with the same meaning Prisma gives them.

---

## Files (one file, one concern)

| Action | File | What |
|--------|------|------|
| Create | `packages/ui/src/lib/applyFilters.ts` | In-memory evaluator over `Record<string, FilterState>` |
| Create | `packages/ui/src/lib/matchesOperator.ts` | One operator → one in-memory predicate, parity with `bracketQuery` |
| Create | Tests for each (table-driven parity tests vs. the documented Prisma semantics) |

## Non-goals

- **Replacing server-side filtering.** Visibility, tenancy/scope, sold-out, and ordering stay in the paginate `where` — they are server-enforced and must not move client-side. FE-004 is display-only narrowing on data the client already legitimately holds.
- A filter-builder UI (FE-003 / INFRA-002 territory).
- Deep JSON-path evaluation (same limit as FE-003).

## Dependencies

- `@template/shared/bracketQuery` (shared operator set — the parity contract)
- FE-003 `FieldMetadata` / `getFieldMetadata` (type-driven coercion + relation paths)
