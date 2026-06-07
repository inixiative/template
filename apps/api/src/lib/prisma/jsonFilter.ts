import { Prisma } from '@template/db';
import { JSON_FIELD_OPERATORS } from '@template/shared/bracketQuery';
import type { BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

const JSON_VALUE_OPERATORS = new Set<string>(JSON_FIELD_OPERATORS);

// Postgres translation: `path` is a key array (`['a','b']`). MySQL diverges
// (`path` is a JSONPath string like `$.a.b`); that variant lives in zealot's copy.
const normalizePath = (value: BracketQueryValue): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split('.').filter(Boolean);
  throw new Error('json filter `path` must be a string or string[]');
};

// Translate a JsonFilter request object into a Prisma (Postgres) JSON where value.
export const buildJsonWhere = (input: BracketQueryRecord, fieldPath: string): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [op, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (op === 'path') {
      out.path = normalizePath(value);
      continue;
    }
    if (!JSON_VALUE_OPERATORS.has(op)) {
      throw new Error(
        `Operator '${op}' is not valid for json field '${fieldPath}'. Valid: path, ${JSON_FIELD_OPERATORS.join(', ')}.`,
      );
    }
    // null on a json field means "db NULL or json null" — Prisma.AnyNull matches both.
    out[op] = value === null ? Prisma.AnyNull : value;
  }
  return out;
};
