/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { type Condition, type LensNarrowing, projectByPath, toPrisma } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { rootLens, searchablePaths } from '@template/db/lens';
import { FIELD_OPERATORS, isArrayFieldOperator, isRelationOperator } from '@template/shared/bracketQuery';
import { makeError } from '#/lib/errors';
import { buildSearchClause } from '#/lib/prisma/buildSearchClause';
import { coerceValueForField } from '#/lib/prisma/coerceValue';
import { dialect } from '#/lib/prisma/dialect';
import { type FieldDef, lookupField } from '#/lib/prisma/fieldMetadata';
import { buildJsonWhere } from '#/lib/prisma/jsonFilter';
import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';
import { getDefaultOperator, getValidOperators, STRING_OPS_WITH_MODE } from '#/lib/prisma/scalarOperators';
import type { BracketQueryPrimitive, BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type BuildWhereOptions = {
  filterLens: LensNarrowing;
  search?: string;
  searchFields?: BracketQueryRecord;
  // Superadmin bypasses the picks whitelist; coercion + op validation still apply.
  skipFieldValidation?: boolean;
  filters?: Record<string, unknown>;
  orNullFields?: string[];
};

const isPrimitive = (v: BracketQueryValue): v is BracketQueryPrimitive =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null;

const isRecord = (v: BracketQueryValue | undefined): v is BracketQueryRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// `tokens.some.name` → `tokens.name`. `lookupField` walks Prisma model
// relations but doesn't know about Prisma's relation operators, so we strip
// them before calling.
const stripRelationOperators = (path: string): string =>
  path
    .split('.')
    .filter((seg) => !isRelationOperator(seg))
    .join('.');

const kindLabel = (field: FieldDef): string => (field.kind === 'enum' ? 'enum' : field.type);

const wrapBareValue = (field: FieldDef, value: BracketQueryPrimitive): Record<string, unknown> => {
  // bare null → is-null. Json matches db-NULL/json-null per provider (dialect.jsonNull).
  if (value === null) {
    return { equals: field.kind === 'scalar' && field.type === 'Json' ? dialect.jsonNull : null };
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
      // Json fields take a JsonFilter object (path/string_contains/…), never a bare value.
      if (field.kind === 'scalar' && field.type === 'Json' && value !== null) {
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
          );
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

    // No relation/field operators → deeper nesting (e.g. `{ user: { name: 'x' } }`).
    result[key] = validateAndTransformSearchFields(
      value,
      searchableFields,
      skipFieldValidation,
      model,
      currentPath,
      depth + 1,
    );
  }

  return result;
};

export const buildWhereClause = (options: BuildWhereOptions): Record<string, unknown> => {
  const { filterLens, search, searchFields, skipFieldValidation = false, filters = {}, orNullFields = [] } = options;
  const lens = rootLens(filterLens);
  const model = lens.model as ModelName;
  const searchableFields = searchablePaths(filterLens);
  const conditions: Record<string, unknown>[] = [];

  // Global search — broad: each searchable field contributes a clause based on its
  // kind (String→contains, String[]→has, Json→string_contains); non-text fields skip.
  if (search && searchableFields.length) {
    const searchConditions = searchableFields.flatMap((field) => {
      const def = lookupField(model, stripRelationOperators(field));
      const clause = def && buildSearchClause(def, search);
      if (!clause) return [];
      if (!validatePathNotation(field)) throw new Error(`Invalid searchable field: ${field}`);
      return [buildNestedPath(field, clause)];
    });
    if (searchConditions.length) conditions.push({ OR: searchConditions });
  }

  if (searchFields && (searchableFields.length || skipFieldValidation)) {
    const transformed = validateAndTransformSearchFields(searchFields, searchableFields, skipFieldValidation, model);
    for (const [key, value] of Object.entries(transformed)) {
      if (orNullFields.includes(key)) {
        conditions.push({ OR: [{ [key]: value }, { [key]: null }] });
      } else {
        conditions.push({ [key]: value });
      }
    }
  }

  // Row scope: the composed where for the root model. projectByPath walks the whole
  // narrowing chain (route filterLens + every stacked scopeNarrowing layer), folding in
  // mapDefaults + filter-first `all`-negation, and exposes the root visit's `whereClauses`.
  // Each is toPrisma'd and ANDed into `conditions`.
  const byPath = projectByPath(filterLens) as Map<string, { whereClauses: Condition[] }>;
  const rootKey = byPath.keys().next().value;
  for (const clause of (rootKey ? byPath.get(rootKey)?.whereClauses : undefined) ?? []) {
    const step = toPrisma(clause, { map: lens, mapName: lens.mapName, model }).steps[0];
    if (step && 'where' in step && Object.keys(step.where).length > 0) conditions.push(step.where);
  }

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
