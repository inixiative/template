/**
 * Prisma query operator constants shared between the API (buildWhereClause)
 * and the frontend (useDataTableController / searchFields serialization).
 *
 * Relation operators are used as path segments in dot-notation filter fields:
 *   'tokens.some.name' → { tokens: { some: { name: { contains: 'x' } } } }
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

export type RelationOperator = (typeof RELATION_OPERATORS)[number];
export type ArrayFieldOperator = (typeof ARRAY_FIELD_OPERATORS)[number];
export type ScalarFieldOperator = (typeof SCALAR_FIELD_OPERATORS)[number];
export type FieldOperator = (typeof FIELD_OPERATORS)[number];

export const isArrayFieldOperator = (op: string): op is ArrayFieldOperator =>
  (ARRAY_FIELD_OPERATORS as readonly string[]).includes(op);

export const isRelationOperator = (op: string): op is RelationOperator =>
  (RELATION_OPERATORS as readonly string[]).includes(op);
