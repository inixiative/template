/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { dialect } from '@template/db/lens';
import { JSON_FIELD_OPERATORS } from '@template/shared/bracketQuery';
import { makeError } from '#/lib/errors';
import type { BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

const JSON_VALUE_OPERATORS = new Set<string>(JSON_FIELD_OPERATORS);

// `path` arrives as dotted string or array; normalize to segments, then let the
// dialect render the provider form (Postgres key array / MySQL JSONPath string).
const toSegments = (value: BracketQueryValue): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split('.').filter(Boolean);
  throw makeError({ status: 400, message: 'json filter `path` must be a string or string[]' });
};

// Translate a JsonFilter request object into a Prisma JSON where value.
export const buildJsonWhere = (input: BracketQueryRecord, fieldPath: string): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [op, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (op === 'path') {
      out.path = dialect.jsonPath(toSegments(value));
      continue;
    }
    if (!JSON_VALUE_OPERATORS.has(op)) {
      throw makeError({
        status: 400,
        message: `Operator '${op}' is not valid for json field '${fieldPath}'. Valid: path, ${JSON_FIELD_OPERATORS.join(', ')}.`,
      });
    }
    // null on a json field → is-null, matched per provider (dialect.jsonNull).
    out[op] = value === null ? dialect.jsonNull : value;
  }
  return out;
};
