import { Prisma } from '@template/db';

// Per-provider query differences, isolated here so the rest of the filter logic
// (buildWhereClause / buildSearchClause / jsonFilter) stays provider-agnostic and
// identical across repos. The MySQL variant (zealot) flips every field.
export const dialect = {
  // Postgres supports case-insensitive string ops; emit `mode: 'insensitive'`.
  // MySQL relies on `_ci` column collation and rejects `mode` → undefined there.
  stringMode: 'insensitive' as 'insensitive' | undefined,
  // is-null on a json field: Postgres can match SQL-NULL OR json-null via AnyNull.
  // MySQL has only JsonNull (no AnyNull).
  jsonNull: Prisma.AnyNull as typeof Prisma.AnyNull | typeof Prisma.JsonNull,
  // json `path`: Postgres takes a key array; MySQL takes a JSONPath string.
  jsonPath: (segments: string[]): string[] | string => segments,
  // scalar-list `has` search: Postgres has scalar arrays; MySQL does not.
  supportsScalarListSearch: true,
};
