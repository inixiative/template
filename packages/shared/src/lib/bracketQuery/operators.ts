/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 */
export const RELATION_OPERATORS = ['some', 'every', 'none', 'is', 'isNot'] as const;

export const ARRAY_FIELD_OPERATORS = ['in', 'notIn'] as const;

export const SCALAR_FIELD_OPERATORS = [
  'contains',
  'equals',
  'lt',
  'lte',
  'gt',
  'gte',
  'startsWith',
  'endsWith',
  'not',
] as const;

export const FIELD_OPERATORS = [...ARRAY_FIELD_OPERATORS, ...SCALAR_FIELD_OPERATORS] as const;

// Value operators for Json fields (bracket grammar). `path` is a selector, not a
// value op, so it's handled separately. Translating these into a Prisma JSON where
// is per-app — the `path` shape diverges (Postgres array vs MySQL JSONPath string).
export const JSON_FIELD_OPERATORS = [
  'equals',
  'not',
  'string_contains',
  'string_starts_with',
  'string_ends_with',
] as const;

export type RelationOperator = (typeof RELATION_OPERATORS)[number];
export type ArrayFieldOperator = (typeof ARRAY_FIELD_OPERATORS)[number];
export type ScalarFieldOperator = (typeof SCALAR_FIELD_OPERATORS)[number];
export type FieldOperator = (typeof FIELD_OPERATORS)[number];
export type JsonFieldOperator = (typeof JSON_FIELD_OPERATORS)[number];

export const isArrayFieldOperator = (op: string): op is ArrayFieldOperator =>
  (ARRAY_FIELD_OPERATORS as readonly string[]).includes(op);

export const isRelationOperator = (op: string): op is RelationOperator =>
  (RELATION_OPERATORS as readonly string[]).includes(op);
