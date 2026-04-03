# FE-003: Schema-Driven Filter Helpers

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-04-03
**Updated**: 2026-04-03

---

## Overview

The data hooks (`usePaginatedData`, `useInfiniteData`, `useDataFilters`) support arbitrary filters via `setFilter(path, { operator, values })`. But consumers must manually know which fields are filterable, what operators apply, and how to construct relation paths. The backend has all this information in the Prisma schema and OpenAPI spec. The frontend should have matching helpers.

## Objectives

- Type-safe filter construction that mirrors backend capabilities
- Per-field metadata (type, valid operators, enum values) derived from the OpenAPI spec
- Relation path helpers matching Prisma's `some`/`every`/`none`/`is`/`isNot`
- Foundation for a future filter-builder UI component

---

## Current State

### Backend (`apps/api`)

- `searchable()` in `lib/prisma/searchable.ts` reads the Prisma runtime data model to validate field paths and detect relations
- `buildWhereClause()` in `lib/prisma/buildWhereClause.ts` accepts `searchFields` (validated) or `filters` (admin, direct Prisma)
- Shared operators in `@template/shared/bracketQuery`: scalar (`contains`, `equals`, `lt`, `lte`, `gt`, `gte`, `startsWith`, `endsWith`, `not`), array (`in`, `notIn`), relation (`some`, `every`, `none`, `is`, `isNot`)

### Frontend (`packages/ui`)

- `makeDataConfig()` reads OpenAPI spec and extracts `searchableFields`, `orderableFields`, `enumFilters`
- `useDataFilters` manages search/filter/sort state with `buildFilterQuery` serialization
- `FilterState.operator` only accepts a subset: `ArrayFieldOperator | 'equals' | 'contains' | 'startsWith' | 'endsWith'` — missing `lt`, `lte`, `gt`, `gte`, `not`

### Gap

The frontend knows field names and enum values but not field types. A consumer can't programmatically determine "createdAt is a date field, so offer gte/lte" or "status is an enum, so offer in/notIn with these values." All of this requires manual knowledge today.

---

## Design

### Step 1: Fix FilterState operator type

**File:** `packages/ui/src/hooks/useDataFilters.ts`

Change `FilterState.operator` to use `FieldOperator` from `@template/shared/bracketQuery`:

```ts
import type { FieldOperator } from '@template/shared/bracketQuery';

export type FilterState = {
  operator: FieldOperator;
  values: string[];
};
```

This accepts all operators the backend supports. No behavior change — `buildFilterQuery` already handles them all.

### Step 2: Per-field metadata from OpenAPI spec

**File:** New `packages/ui/src/lib/getFieldMetadata.ts`

Extend the existing `getQueryMetadata` pattern to produce per-field info:

```ts
export type FieldType = 'string' | 'number' | 'integer' | 'date' | 'boolean' | 'enum' | 'relation';

export type FieldMetadata = {
  /** Full path: 'name', 'sourceUser.email', 'tokens.some.name' */
  path: string;
  /** Inferred from OpenAPI type + format */
  type: FieldType;
  /** For enum fields: the valid values */
  enumValues?: string[];
  /** Operators valid for this field type */
  operators: FieldOperator[];
  /** Whether the backend accepts this as a searchField */
  isSearchable: boolean;
  /** Whether the backend accepts this in orderBy */
  isOrderable: boolean;
};

export function getFieldMetadata(operationId: string): FieldMetadata[];
```

Type inference rules:
- `type: 'string', format: 'date-time'` → `FieldType: 'date'`
- `type: 'string', enum: [...]` → `FieldType: 'enum'`
- `type: 'string'` → `FieldType: 'string'`
- `type: 'integer'` or `type: 'number'` → `FieldType: 'number'`
- `type: 'boolean'` → `FieldType: 'boolean'`
- `type: 'object'` with relation properties → `FieldType: 'relation'`

### Step 3: Operator-per-type mapping

**File:** New `packages/ui/src/lib/operatorsForFieldType.ts`

One file, one function:

```ts
export function operatorsForFieldType(type: FieldType): FieldOperator[];
```

Mapping:
- `string` → `contains`, `equals`, `startsWith`, `endsWith`, `in`, `notIn`, `not`
- `number` / `integer` → `equals`, `lt`, `lte`, `gt`, `gte`, `in`, `notIn`, `not`
- `date` → `equals`, `lt`, `lte`, `gt`, `gte`, `not`
- `enum` → `equals`, `in`, `notIn`
- `boolean` → `equals`, `not`
- `json` → `equals` (top-level only — see Step 6)
- `relation` → (no direct operators — relations use path segments: `some`, `every`, `none`)

### Step 4: Relation path builder

**File:** New `packages/ui/src/lib/buildRelationPath.ts`

One file, one function:

```ts
import type { RelationOperator } from '@template/shared/bracketQuery';

/** Build a dot-notation filter path through a Prisma relation. */
export function buildRelationPath(
  relation: string,
  operator: RelationOperator,
  field: string,
): string;
// buildRelationPath('tokens', 'some', 'name') → 'tokens.some.name'
```

### Step 4b: Field filterability check

**File:** New `packages/ui/src/lib/isFieldFilterable.ts`

One file, one function:

```ts
/** Check if a field path is filterable against a DataConfig. */
export function isFieldFilterable(config: DataConfig, path: string): boolean;
```

Returns true if the path is in `searchableFields` (non-admin) or if `adminMode` is true (admin can filter anything).

### Step 5: Extend DataConfig with field metadata

**File:** `packages/ui/src/lib/makeDataConfig.ts`

```ts
export type DataConfig = {
  // ... existing fields ...
  /** Per-field metadata for building filter UI. */
  fields: FieldMetadata[];
};
```

`makeDataConfig` calls `getFieldMetadata` and includes the result.

---

### Step 6: JSON field support

**Scope:** Top-level JSON fields only. The OpenAPI spec types these as `object` or `Record<string, unknown>`. Prisma supports `equals` on JSON columns and `path`-based queries for PostgreSQL (`jsonb`), but the OpenAPI spec does not describe the JSON structure.

**Approach:**
- `FieldType: 'json'` for fields typed as `object` without defined properties
- `operatorsForFieldType('json')` returns `['equals']` (exact match only)
- Document that deep JSON filtering (`jsonPath` queries) is not auto-discovered and requires manual `setFilter` calls with the appropriate Prisma JSON path syntax
- Admin mode can pass JSON path filters directly via `filters[...]` since it bypasses validation

### Step 7: Search mode awareness

The helpers should make the `search` vs `searchFields` distinction explicit:

- `search` (combined mode): one search box, API ORs `contains` across all `searchableFields`
- `searchFields[field][operator]=value` (field mode): per-field targeted filtering

### Step 8: Fix relation path handling in combined search (BACKEND BUG)

**Problem:** `searchable()` produces flat paths like `organizationUsers.role` for one-to-many relations. But `buildWhereClause` in combined search mode calls `buildNestedPath(field, { contains: search })` which produces `{ organizationUsers: { role: { contains: ... } } }`. Prisma rejects this because `organizationUsers` is an array relation — it needs `{ organizationUsers: { some: { role: { contains: ... } } } }`.

**Why it hasn't broken yet:** No `searchable()` config in the codebase currently includes relation paths. The inquiry searchable fields are all flat scalars. But the `searchable()` helper and its test suite explicitly support relation paths (e.g. `organizationUsers.user.name`), so this is a latent bug that will surface as soon as someone adds a relation path to a searchable config.

**Real use case:** Searching inquiries by the source user's email, the org's name, or the space's name. These are all relation paths through one-to-many joins.

**Design constraint:** Combined search (`search` param) should only support fields that are directly pathable without relation operators — flat scalars and many-to-one relations (e.g. `sourceUser.email` where `sourceUser` is a belongs-to). One-to-many relations (e.g. `organizationUsers.role` where `organizationUsers` is a has-many) require `some`/`every`/`none` and must use `searchFields` mode instead. `searchable()` should validate this at config time and reject one-to-many paths, or separate them into a `searchFields`-only list.

**Fix (backend):** `buildNestedPath` needs to be relation-aware. When a path segment corresponds to a one-to-many relation in the Prisma schema, inject `some` automatically. This requires either:
- (a) Passing the Prisma runtime data model to `buildNestedPath` so it can detect relation types, or
- (b) Having `searchable()` encode the relation operator in the path (e.g. `organizationUsers.some.role` instead of `organizationUsers.role`) and having `buildNestedPath` respect it

Option (b) is simpler and keeps the path self-describing. The `searchable()` helper already reads the Prisma data model and knows which fields are relations. It just needs to inject the appropriate operator (`some` for one-to-many, direct nesting for one-to-one/many-to-one).

**Fix (frontend):** `buildRelationPath` (from Step 4) should require the relation operator, matching the backend convention. The `FieldMetadata` type should indicate whether a field is behind a one-to-many or many-to-one relation so the frontend can construct the correct path.

**Files:**
- `apps/api/src/lib/prisma/searchable.ts` — inject `some`/`is` in paths based on relation type
- `apps/api/src/lib/prisma/buildWhereClause.ts` — handle paths containing relation operators
- `apps/api/src/lib/prisma/pathNotation.ts` — `buildNestedPath` may need relation awareness
- Tests for all of the above

`FieldMetadata.isSearchable` indicates the field is in the `searchableFields` whitelist. In `combined` mode, all searchable fields participate in the top-level `search` param automatically. In `field` mode, each field gets its own `searchFields[field][contains]` entry.

Admin mode uses `filters[...]` which bypasses the whitelist entirely — every field in the response schema is filterable.

---

## Files (one file, one concern)

| Action | File | What |
|--------|------|------|
| Modify | `packages/ui/src/lib/buildFilterQuery.ts` | `FilterState.operator` → `FieldOperator` |
| Create | `packages/ui/src/lib/getFieldMetadata.ts` | Per-field type/operator extraction from OpenAPI |
| Create | `packages/ui/src/lib/operatorsForFieldType.ts` | Type → valid operators mapping |
| Create | `packages/ui/src/lib/buildRelationPath.ts` | Dot-notation path builder for Prisma relations |
| Create | `packages/ui/src/lib/isFieldFilterable.ts` | Check field filterability against config |
| Modify | `packages/ui/src/lib/makeDataConfig.ts` | Add `fields: FieldMetadata[]` |
| Create | Tests for each new file (one test file per source file) |

## Non-goals

- Filter builder UI component (separate ticket — this provides the data layer)
- Deep JSON path querying auto-discovery (JSON structure not in OpenAPI spec)
- Client-side filtering (this is for server-side query construction)

## Dependencies

- `@template/shared/bracketQuery` (already exists, shared with backend)
- OpenAPI spec generated by `generate:sdk` (already exists)
