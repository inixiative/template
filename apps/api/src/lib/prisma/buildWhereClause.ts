import { type LensNarrowing, toPrisma } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { rootLens } from '@template/db/lens';
import { FIELD_OPERATORS, isArrayFieldOperator, isRelationOperator } from '@template/shared/bracketQuery';
import { coerceValueForField } from '#/lib/prisma/coerceValue';
import { type FieldDef, isStringPath, lookupField } from '#/lib/prisma/fieldMetadata';
import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';
import { getDefaultOperator, getValidOperators, STRING_OPS_WITH_MODE } from '#/lib/prisma/scalarOperators';
import type { BracketQueryPrimitive, BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type BuildWhereOptions = {
  narrowing: LensNarrowing;
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
  const op = getDefaultOperator(field);
  const coerced = coerceValueForField(field, value);
  if (field.kind === 'scalar' && field.type === 'String' && STRING_OPS_WITH_MODE.has(op)) {
    return { [op]: coerced, mode: 'insensitive' };
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
      throw new Error(
        `Operator '${op}' is not valid for field '${fieldPath}' (${kindLabel(field)}). Valid: ${validOps.join(', ')}.`,
      );
    }
    if (isArrayFieldOperator(op) && !Array.isArray(opValue)) {
      out[op] = [coerceValueForField(field, opValue)];
    } else {
      out[op] = coerceValueForField(field, opValue);
    }
  }

  // String ops support `mode: 'insensitive'`. Auto-add it when any mode-
  // capable op is present and the caller didn't override `mode`.
  if (
    field.kind === 'scalar' &&
    field.type === 'String' &&
    out.mode === undefined &&
    Object.keys(out).some((k) => STRING_OPS_WITH_MODE.has(k))
  ) {
    out.mode = 'insensitive';
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
  if (depth > 10) throw new Error('Search query nesting too deep (max 10 levels)');

  const result: BracketQueryRecord = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const currentPath = prefix ? `${prefix}.${key}` : key;

    // Bare scalar — apply field's default operator + coerce.
    if (isPrimitive(value)) {
      if (!validatePathNotation(currentPath)) {
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      const field = lookupField(model, stripRelationOperators(currentPath));
      if (!field) {
        // Path doesn't resolve in the schema (admin bypass let through an
        // unknown field, or it's a synthetic path). Pass through as-is.
        result[key] = value;
        continue;
      }
      result[key] = wrapBareValue(field, value) as unknown as BracketQueryValue;
      continue;
    }

    if (Array.isArray(value)) {
      throw new Error(`Field '${currentPath}' does not support array values without an operator`);
    }
    if (!isRecord(value)) continue;

    const keys = Object.keys(value);
    const hasRelationOp = keys.some(isRelationOperator);
    const hasFieldOp = keys.some((k) => (FIELD_OPERATORS as readonly string[]).includes(k));

    if (hasRelationOp) {
      if (!skipFieldValidation && !searchableFields.some((f) => f === currentPath || f.startsWith(`${currentPath}.`))) {
        throw new Error(`Relation '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
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
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
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
  const { narrowing, search, searchFields, skipFieldValidation = false, filters = {}, orNullFields = [] } = options;
  const lens = rootLens(narrowing);
  const model = lens.model as ModelName;
  const searchableFields = narrowing.root?.picks ?? [];
  const conditions: Record<string, unknown>[] = [];

  // Global search — `contains` only makes sense for text, drop everything else.
  if (search && searchableFields.length) {
    const stringFields = searchableFields.filter((f) => isStringPath(model, stripRelationOperators(f)));
    if (stringFields.length) {
      const searchConditions = stringFields.map((field) => {
        if (!validatePathNotation(field)) throw new Error(`Invalid searchable field: ${field}`);
        return buildNestedPath(field, { contains: search, mode: 'insensitive' as const });
      });
      conditions.push({ OR: searchConditions });
    }
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

  // Per-request scoping: root-anchored where → Prisma where via toPrisma.
  if (narrowing.root?.where !== undefined) {
    const step = toPrisma(narrowing.root.where, { map: lens, mapName: lens.mapName, model }).steps[0];
    if (step && 'where' in step && Object.keys(step.where).length > 0) conditions.push(step.where);
  }

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
