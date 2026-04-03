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

**File:** New `packages/ui/src/lib/filterHelpers.ts`

```ts
/** Returns valid operators for a given field type. */
export function operatorsForType(type: FieldType): FieldOperator[];
```

Mapping:
- `string` → `contains`, `equals`, `startsWith`, `endsWith`, `in`, `notIn`, `not`
- `number` / `integer` → `equals`, `lt`, `lte`, `gt`, `gte`, `in`, `notIn`, `not`
- `date` → `equals`, `lt`, `lte`, `gt`, `gte`, `not`
- `enum` → `equals`, `in`, `notIn`
- `boolean` → `equals`, `not`
- `relation` → (no direct operators — relations use path segments: `some`, `every`, `none`)

### Step 4: Relation path helpers

**File:** Same `packages/ui/src/lib/filterHelpers.ts`

```ts
import type { RelationOperator } from '@template/shared/bracketQuery';

/** Build a dot-notation filter path through a relation. */
export function relationPath(
  relation: string,
  operator: RelationOperator,
  field: string,
): string;
// relationPath('tokens', 'some', 'name') → 'tokens.some.name'

/** Check if a field path is filterable against a DataConfig. */
export function isFilterable(config: DataConfig, path: string): boolean;
```

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

## Files

| Action | File | What |
|--------|------|------|
| Modify | `packages/ui/src/hooks/useDataFilters.ts` | `FilterState.operator` → `FieldOperator` |
| Create | `packages/ui/src/lib/getFieldMetadata.ts` | Per-field type/operator extraction |
| Create | `packages/ui/src/lib/filterHelpers.ts` | `operatorsForType`, `relationPath`, `isFilterable` |
| Modify | `packages/ui/src/lib/makeDataConfig.ts` | Add `fields: FieldMetadata[]` |
| Create | Tests for each new file |

## Non-goals

- Filter builder UI component (separate ticket — this provides the data layer)
- JSON field deep filtering (OpenAPI doesn't describe JSON internals)
- Client-side filtering (this is for server-side query construction)

## Dependencies

- `@template/shared/bracketQuery` (already exists, shared with backend)
- OpenAPI spec generated by `generate:sdk` (already exists)
