/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { dialect } from '@template/db/lens';
import { JSON_FIELD_OPERATORS } from '@template/shared/bracketQuery';
import { mapValues, pickBy } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { escapeLikePattern } from '#/lib/prisma/escapeLikePattern';
import type { BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

const JSON_VALUE_OPERATORS = new Set<string>(JSON_FIELD_OPERATORS);
const JSON_PATTERN_OPERATORS = new Set([
  'string_contains',
  'string_starts_with',
  'string_ends_with',
]);

// `path` arrives as dotted string or array; normalize to segments, then let the
// dialect render the provider form (Postgres key array / MySQL JSONPath string).
const toSegments = (value: BracketQueryValue): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split('.').filter(Boolean);
  throw makeError({ status: 400, message: 'json filter `path` must be a string or string[]' });
};

// Translate a JsonFilter request object into a Prisma JSON where value.
export const buildJsonWhere = (
  input: BracketQueryRecord,
  fieldPath: string,
): Record<string, unknown> =>
  mapValues(
    pickBy(input, (value): value is BracketQueryValue => value !== undefined),
    (value, op) => {
      if (op === 'path') return dialect.jsonPath(toSegments(value));
      if (!JSON_VALUE_OPERATORS.has(op)) {
        throw makeError({
          status: 400,
          message: `Operator '${op}' is not valid for json field '${fieldPath}'. Valid: path, ${JSON_FIELD_OPERATORS.join(', ')}.`,
        });
      }
      if (value === null) return dialect.jsonNull;
      return JSON_PATTERN_OPERATORS.has(op) && typeof value === 'string'
        ? escapeLikePattern(value)
        : value;
    },
  );
