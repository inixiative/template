/**
 * @atlas
 * @kind constant
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { ModelField } from '@template/db';

const ENUM_OPS = ['equals', 'in', 'notIn', 'not'] as const;

// json entry is intentionally empty so any operator on a json field reads
// as "invalid" — coerceValueForField throws on json before this is consulted,
// but the empty list is the right answer either way.
const OPERATORS_BY_TYPE: Record<string, readonly string[]> = {
  String: ['contains', 'startsWith', 'endsWith', 'equals', 'in', 'notIn', 'not'],
  Int: ['equals', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'not'],
  BigInt: ['equals', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'not'],
  Float: ['equals', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'not'],
  Decimal: ['equals', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'not'],
  DateTime: ['equals', 'gt', 'gte', 'lt', 'lte', 'not'],
  Boolean: ['equals', 'not'],
  Json: [],
};

// Bare-value shorthand: when a caller doesn't wrap a value in `{ op: val }`,
// fall back to the most natural op. Strings get fuzzy match; everything
// else gets exact equality.
const DEFAULT_OP_BY_TYPE: Record<string, string> = {
  String: 'contains',
};

export const getValidOperators = (field: ModelField): readonly string[] => {
  if (field.kind === 'enum') return ENUM_OPS;
  if (field.kind !== 'scalar') return [];
  return OPERATORS_BY_TYPE[field.type] ?? [];
};

export const getDefaultOperator = (field: ModelField): string =>
  field.kind === 'scalar' ? (DEFAULT_OP_BY_TYPE[field.type] ?? 'equals') : 'equals';

export const isValidOperatorForField = (field: ModelField, operator: string): boolean =>
  getValidOperators(field).includes(operator);
