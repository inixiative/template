import type { FieldDef } from '#/lib/prisma/fieldMetadata';

// Prisma supports `mode: 'insensitive'` on these string ops. We always emit
// it for them so user-facing search matches regardless of case. `in` /
// `notIn` don't support `mode` natively — those remain case-sensitive on
// strings (caveat lives at the call site).
export const STRING_OPS_WITH_MODE = new Set(['contains', 'startsWith', 'endsWith', 'equals', 'not']);

const ENUM_OPS = ['equals', 'in', 'notIn', 'not'] as const;

// json entry is intentionally empty so any operator on a json field reads
// as "invalid" — coerceValueForField throws on json before this is consulted,
// but the empty list is the right answer either way.
const OPERATORS_BY_TYPE: Record<string, readonly string[]> = {
  String: ['contains', 'startsWith', 'endsWith', 'equals', 'in', 'notIn', 'not'],
  Int: ['equals', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'not'],
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

export const getValidOperators = (field: FieldDef): readonly string[] => {
  if (field.kind === 'enum') return ENUM_OPS;
  if (field.kind !== 'scalar') return [];
  return OPERATORS_BY_TYPE[field.type] ?? [];
};

export const getDefaultOperator = (field: FieldDef): string =>
  field.kind === 'scalar' ? (DEFAULT_OP_BY_TYPE[field.type] ?? 'equals') : 'equals';

export const isValidOperatorForField = (field: FieldDef, operator: string): boolean =>
  getValidOperators(field).includes(operator);
