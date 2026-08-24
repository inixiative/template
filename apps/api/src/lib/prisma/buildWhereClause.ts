/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { dialect, rootLens, searchablePaths } from '@template/db/lens';
import {
  FIELD_OPERATORS,
  isArrayFieldOperator,
  isBracketSymbol,
  isCombinator,
  isRelationOperator,
} from '@template/shared/bracketQuery';
import { makeError } from '#/lib/errors';
import { buildSearchPath } from '#/lib/prisma/buildSearchPath';
import { coerceValueForField } from '#/lib/prisma/coerceValue';
import { type FieldDef, lookupField } from '#/lib/prisma/fieldMetadata';
import { fieldSearchOperator } from '#/lib/prisma/fieldSearchOperator';
import { buildJsonWhere } from '#/lib/prisma/jsonFilter';
import { validatePathNotation } from '#/lib/prisma/pathNotation';
import { getDefaultOperator, getValidOperators, STRING_OPS_WITH_MODE } from '#/lib/prisma/scalarOperators';
import type { BracketQueryPrimitive, BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type BuildWhereOptions = {
  filterLens: LensNarrowing;
  search?: string;
  searchFields?: BracketQueryRecord;
  // Superadmin: skips the picks whitelist (coercion + op validation still apply).
  skipFieldValidation?: boolean;
  filters?: Record<string, unknown>;
  orNullFields?: string[];
};

const isPrimitive = (v: BracketQueryValue): v is BracketQueryPrimitive =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null;

const isRecord = (v: BracketQueryValue | undefined): v is BracketQueryRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Prisma rejects a NULL member inside `in` (a typed `Int | Null` array is invalid). When the bracket
// query carries one (`[in][:]=null`), pull the NULL out so it can be OR'd back as `{ field: null }` —
// the only way to match concrete values PLUS NULL in one filter.
const splitNullFromInClause = (
  value: BracketQueryValue | undefined,
): { clause: BracketQueryValue | undefined; orNull: boolean } => {
  if (!isRecord(value) || !Array.isArray(value.in) || !value.in.includes(null)) {
    return { clause: value, orNull: false };
  }
  return { clause: { ...value, in: value.in.filter((v) => v !== null) }, orNull: true };
};

// `tokens.some.name` → `tokens.name`. `lookupField` walks Prisma model
// relations but doesn't know about Prisma's relation operators, so we strip
// them before calling.
const stripRelationOperators = (path: string): string =>
  path
    .split('.')
    .filter((seg) => !isRelationOperator(seg))
    .join('.');

const MAX_COMBINATOR_CHILDREN = 25;

// `{ '0': …, '1': … }` → ordered array. The wire carries combinator siblings under numeric
// segments and the parse yields numeric-STRING keys, never a real array, so order comes from
// the key rather than insertion.
const indexedChildren = (combinator: string, value: BracketQueryValue | undefined): BracketQueryRecord[] => {
  const entries = isRecord(value) ? Object.entries(value) : [];
  if (!entries.length || entries.some(([key, child]) => !/^\d+$/.test(key) || !isRecord(child))) {
    throw makeError({
      status: 400,
      message: `'${combinator}' requires indexed children, e.g. ${combinator}[0][field]`,
    });
  }
  // Every group is its own relation subquery, so an unbounded list buys unbounded database
  // work off one URL. Bounded for the same reason the nesting depth is.
  if (entries.length > MAX_COMBINATOR_CHILDREN) {
    throw makeError({
      status: 400,
      message: `'${combinator}' accepts at most ${MAX_COMBINATOR_CHILDREN} groups, got ${entries.length}`,
    });
  }
  return entries.sort(([a], [b]) => Number(a) - Number(b)).map(([, child]) => child as BracketQueryRecord);
};

const kindLabel = (field: FieldDef): string => (field.kind === 'enum' ? 'enum' : field.type);

const wrapBareValue = (field: FieldDef, value: BracketQueryPrimitive): Record<string, unknown> => {
  // Bare symbols (null/true/false) on a json column → equals that json scalar (null
  // is the provider json-null). Non-symbol bare values never reach here for json.
  if (field.kind === 'scalar' && field.type === 'Json' && isBracketSymbol(value)) {
    return { equals: value === null ? dialect.jsonNull : value };
  }
  if (value === null) {
    return { equals: null };
  }
  const op = getDefaultOperator(field);
  const coerced = coerceValueForField(field, value);
  if (dialect.stringMode && field.kind === 'scalar' && field.type === 'String' && STRING_OPS_WITH_MODE.has(op)) {
    return { [op]: coerced, mode: dialect.stringMode };
  }
  return { [op]: coerced };
};

const transformOperatorValue = (
  field: FieldDef,
  value: BracketQueryRecord,
  fieldPath: string,
): Record<string, unknown> => {
  const validOps = getValidOperators(field);
  const out: Record<string, unknown> = {};

  for (const [op, opValue] of Object.entries(value)) {
    // Non-operator keys (like `mode`) pass through. Anything that looks
    // like an operator must be valid for the field's kind.
    if (!(FIELD_OPERATORS as readonly string[]).includes(op)) {
      out[op] = opValue;
      continue;
    }
    if (!validOps.includes(op)) {
      throw makeError({
        status: 400,
        message: `Operator '${op}' is not valid for field '${fieldPath}' (${kindLabel(field)}). Valid: ${validOps.join(', ')}.`,
      });
    }
    if (isArrayFieldOperator(op) && !Array.isArray(opValue)) {
      out[op] = [coerceValueForField(field, opValue)];
    } else {
      out[op] = coerceValueForField(field, opValue);
    }
  }

  // String ops support `mode` on Postgres. Auto-add it when any mode-capable op is
  // present and the caller didn't override `mode`. No-op where dialect omits mode.
  if (
    dialect.stringMode &&
    field.kind === 'scalar' &&
    field.type === 'String' &&
    out.mode === undefined &&
    Object.keys(out).some((k) => STRING_OPS_WITH_MODE.has(k))
  ) {
    out.mode = dialect.stringMode;
  }
  return out;
};

const validateAndTransformSearchFields = (
  obj: BracketQueryRecord,
  searchableFields: readonly string[],
  skipFieldValidation: boolean,
  model: ModelName,
  prefix = '',
  depth = 0,
): BracketQueryRecord => {
  if (depth > 10) throw makeError({ status: 400, message: 'Search query nesting too deep (max 10 levels)' });

  const result: BracketQueryRecord = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    // Combinators group clauses and name no field, so they do NOT extend the path — children
    // resolve against the same prefix, and the per-leaf whitelist still applies inside each.
    if (isCombinator(key)) {
      result[key] = indexedChildren(key, value).map((child) =>
        validateAndTransformSearchFields(child, searchableFields, skipFieldValidation, model, prefix, depth + 1),
      ) as unknown as BracketQueryValue;
      continue;
    }

    const currentPath = prefix ? `${prefix}.${key}` : key;

    // Bare scalar — apply field's default operator + coerce.
    if (isPrimitive(value)) {
      if (!validatePathNotation(currentPath)) {
        throw makeError({ status: 400, message: `Invalid search field: ${currentPath}` });
      }
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw makeError({
          status: 400,
          message: `Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`,
        });
      }
      const field = lookupField(model, stripRelationOperators(currentPath));
      if (!field) {
        // Path doesn't resolve in the schema (admin bypass let through an
        // unknown field, or it's a synthetic path). Pass through as-is.
        result[key] = value;
        continue;
      }
      // Json fields take a JsonFilter object (path/string_contains/…). The only bare
      // values allowed are symbols (null/true/false → equals that json scalar).
      if (field.kind === 'scalar' && field.type === 'Json' && !isBracketSymbol(value)) {
        throw makeError({
          status: 400,
          message: `Json field '${currentPath}' requires an operator (path, string_contains, …)`,
        });
      }
      result[key] = wrapBareValue(field, value) as unknown as BracketQueryValue;
      continue;
    }

    if (Array.isArray(value)) {
      throw makeError({
        status: 400,
        message: `Field '${currentPath}' does not support array values without an operator`,
      });
    }
    if (!isRecord(value)) continue;

    // Json fields use their own operator set (path/string_contains/…), translated
    // to a Prisma JSON where rather than the scalar operator pipeline.
    const jsonField = lookupField(model, stripRelationOperators(currentPath));
    if (jsonField?.kind === 'scalar' && jsonField.type === 'Json') {
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw makeError({
          status: 400,
          message: `Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`,
        });
      }
      result[key] = buildJsonWhere(value, currentPath) as unknown as BracketQueryValue;
      continue;
    }

    const keys = Object.keys(value);
    const hasRelationOp = keys.some(isRelationOperator);
    const hasFieldOp = keys.some((k) => (FIELD_OPERATORS as readonly string[]).includes(k));

    if (hasRelationOp) {
      if (!skipFieldValidation && !searchableFields.some((f) => f === currentPath || f.startsWith(`${currentPath}.`))) {
        throw makeError({
          status: 400,
          message: `Relation '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`,
        });
      }
      const relationValue: BracketQueryRecord = {};
      for (const [opKey, opValue] of Object.entries(value)) {
        if (isRelationOperator(opKey) && isRecord(opValue)) {
          relationValue[opKey] = validateAndTransformSearchFields(
            opValue,
            searchableFields,
            skipFieldValidation,
            model,
            currentPath,
            depth + 1,
          ) as BracketQueryValue;
        }
      }
      result[key] = relationValue;
      continue;
    }

    if (hasFieldOp) {
      if (!validatePathNotation(currentPath)) {
        throw makeError({ status: 400, message: `Invalid search field: ${currentPath}` });
      }
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw makeError({
          status: 400,
          message: `Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`,
        });
      }
      const field = lookupField(model, stripRelationOperators(currentPath));
      if (!field) {
        // Unknown path under skip-bypass — pass through unchanged.
        result[key] = value;
        continue;
      }
      result[key] = transformOperatorValue(field, value, currentPath) as unknown as BracketQueryValue;
      continue;
    }

    result[key] = validateAndTransformSearchFields(
      value,
      searchableFields,
      skipFieldValidation,
      model,
      currentPath,
      depth + 1,
    ) as BracketQueryValue;
  }

  return result;
};

// A group's own conditions AND together. One condition needs no wrapper. An empty group cannot
// reach here: `indexedChildren` requires every child to be a record, and every key of a record
// yields a condition.
const allOf = (conditions: Record<string, unknown>[]): Record<string, unknown> =>
  conditions.length === 1 ? (conditions[0] as Record<string, unknown>) : { AND: conditions };

// One transformed record → the conditions it contributes, which the caller ANDs together.
// Combinator children recurse through here rather than being pushed raw, so a grouped leaf gets
// the same null-in-`in` split and orNull treatment a top-level leaf gets.
//
// The two combinators part ways on what happens to those children. AND is associative with the
// caller's AND, so its children flatten into the caller's list. OR is not: flattening its
// children would turn a union into an intersection, silently, so it contributes exactly one
// `{ OR: [...] }` condition whose arms are each group's own conditions AND'd together.
const toConditions = (record: BracketQueryRecord, orNullFields: string[]): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (isCombinator(key) && Array.isArray(value)) {
      const children = value as unknown as BracketQueryRecord[];
      if (key === 'OR') {
        out.push({ OR: children.map((child) => allOf(toConditions(child, orNullFields))) });
      } else {
        for (const child of children) out.push(...toConditions(child, orNullFields));
      }
      continue;
    }
    const { clause, orNull } = splitNullFromInClause(value);
    if (orNull || orNullFields.includes(key)) {
      out.push({ OR: [{ [key]: clause }, { [key]: null }] });
    } else {
      out.push({ [key]: clause });
    }
  }

  return out;
};

export const buildWhereClause = (options: BuildWhereOptions): Record<string, unknown> => {
  const { filterLens, search, searchFields, skipFieldValidation = false, filters = {}, orNullFields = [] } = options;
  const lens = rootLens(filterLens);
  const model = lens.model as ModelName;
  const searchableFields = searchablePaths(filterLens);
  const conditions: Record<string, unknown>[] = [];

  if (search?.trim() && searchableFields.length) {
    // Split on whitespace so "Phil Smith" matches a row where one field contains "Phil" and another
    // contains "Smith" — the whole string is rarely in one column. Each token ORs across the fields;
    // tokens AND together.
    for (const token of search.trim().split(/\s+/)) {
      const searchConditions = searchableFields.flatMap((field) => {
        const def = lookupField(model, stripRelationOperators(field));
        const clause = def && fieldSearchOperator(def, token);
        if (!clause) return [];
        if (!validatePathNotation(field))
          throw makeError({ status: 400, message: `Invalid searchable field: ${field}` });
        return [buildSearchPath(model, field, clause)];
      });
      if (searchConditions.length) conditions.push({ OR: searchConditions });
    }
  }

  if (searchFields && (searchableFields.length || skipFieldValidation)) {
    const transformed = validateAndTransformSearchFields(searchFields, searchableFields, skipFieldValidation, model);
    conditions.push(...toConditions(transformed, orNullFields));
  }

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
