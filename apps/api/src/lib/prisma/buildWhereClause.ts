/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import {
  type Condition,
  executePrismaQueryPlan,
  type LensNarrowing,
  projectByPath,
  toPrisma,
} from '@inixiative/json-rules';
import { db, type ModelName } from '@template/db';
import { dialect, rootLens, searchablePaths } from '@template/db/lens';
import {
  FIELD_OPERATORS,
  isArrayFieldOperator,
  isBracketSymbol,
  isRelationOperator,
} from '@template/shared/bracketQuery';
import { makeError } from '#/lib/errors';
import { buildSearchClause } from '#/lib/prisma/buildSearchClause';
import { buildSearchPath } from '#/lib/prisma/buildSearchPath';
import { coerceValueForField } from '#/lib/prisma/coerceValue';
import { type FieldDef, lookupField } from '#/lib/prisma/fieldMetadata';
import { buildJsonWhere } from '#/lib/prisma/jsonFilter';
import { validatePathNotation } from '#/lib/prisma/pathNotation';
import { getDefaultOperator, getValidOperators, STRING_OPS_WITH_MODE } from '#/lib/prisma/scalarOperators';
import { hasSoftDelete, mentionsDeletedAt } from '#/lib/prisma/softDeleteScope';
import type { BracketQueryPrimitive, BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type BuildWhereOptions = {
  filterLens: LensNarrowing;
  search?: string;
  searchFields?: BracketQueryRecord;
  // Superadmin bypasses the picks whitelist; coercion + op validation still apply.
  skipFieldValidation?: boolean;
  // Superadmin sees soft-deleted rows: skips the per-visit `deletedAt: null` injection.
  includeSoftDeleted?: boolean;
  // The caller's own findMany where (paginate's `options.where`) — consulted only to
  // detect an explicit root-level `deletedAt`, which wins over the injected scope.
  callerWhere?: Record<string, unknown>;
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

// Visit keys where the client's searchFields already filter `deletedAt` — those
// nodes keep the caller's filter instead of the injected live scope.
const collectExplicitDeletedAtVisits = (
  obj: BracketQueryRecord,
  model: string,
  prefix = '',
  out = new Set<string>(),
): Set<string> => {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const segments = stripRelationOperators(currentPath).split('.');
    if (segments[segments.length - 1] === 'deletedAt') {
      const parent = segments.slice(0, -1).join('.');
      out.add(parent ? `${model}.${parent}` : model);
      continue;
    }
    if (isRecord(value)) collectExplicitDeletedAtVisits(value, model, currentPath, out);
  }
  return out;
};

type VisitWhereFn = (visitKey: string) => Record<string, unknown>[];

// `every` composes filter-first by implication; plain AND would demand every
// related row be in scope. `isNot` gets scope as an `is` sibling (fail closed,
// matching applyLens's to-one convention) — folding it inside would make an
// out-of-scope related row pass the negation.
const scopeRelationValue = (
  op: string,
  value: BracketQueryValue,
  wheres: Record<string, unknown>[],
): BracketQueryValue => {
  if (!wheres.length || op === 'isNot') return value;
  if (op === 'every') return { OR: [{ NOT: { AND: wheres } }, value] } as unknown as BracketQueryValue;
  return { AND: [value, ...wheres] } as unknown as BracketQueryValue;
};

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
  visitWhere: VisitWhereFn,
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
      const wheres = visitWhere(`${model}.${stripRelationOperators(currentPath)}`);
      const relationValue: BracketQueryRecord = {};
      for (const [opKey, opValue] of Object.entries(value)) {
        if (isRelationOperator(opKey) && isRecord(opValue)) {
          const transformed = validateAndTransformSearchFields(
            opValue,
            searchableFields,
            skipFieldValidation,
            model,
            visitWhere,
            currentPath,
            depth + 1,
          );
          relationValue[opKey] = scopeRelationValue(opKey, transformed as BracketQueryValue, wheres);
        }
      }
      if (wheres.length && relationValue.isNot !== undefined && relationValue.is === undefined) {
        relationValue.is = { AND: wheres } as unknown as BracketQueryValue;
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
    const nested = validateAndTransformSearchFields(
      value,
      searchableFields,
      skipFieldValidation,
      model,
      visitWhere,
      currentPath,
      depth + 1,
    );
    const nestedField = lookupField(model, stripRelationOperators(currentPath));
    result[key] =
      nestedField?.kind === 'object'
        ? scopeRelationValue(
            'is',
            nested as BracketQueryValue,
            visitWhere(`${model}.${stripRelationOperators(currentPath)}`),
          )
        : (nested as BracketQueryValue);
  }

  return result;
};

export const buildWhereClause = async (options: BuildWhereOptions): Promise<Record<string, unknown>> => {
  const {
    filterLens,
    search,
    searchFields,
    skipFieldValidation = false,
    includeSoftDeleted = false,
    callerWhere,
    filters = {},
    orNullFields = [],
  } = options;
  const lens = rootLens(filterLens);
  const model = lens.model as ModelName;
  const searchableFields = searchablePaths(filterLens);
  const conditions: Record<string, unknown>[] = [];

  // Row scope per projectByPath visit: root wheres AND into the query; relation
  // visits' wheres fold in only where a query path traverses the relation.
  // Count-operator clauses compile to a groupBy plan — executed here so every
  // resolved where is plain. Bridges compile to the `{}` over-fetch sentinel,
  // which is not expressible as SQL: fail closed rather than widen row scope.
  const byPath = projectByPath(filterLens);
  const explicitDeletedAtVisits = searchFields
    ? collectExplicitDeletedAtVisits(searchFields, model)
    : new Set<string>();
  if (mentionsDeletedAt(callerWhere)) explicitDeletedAtVisits.add(model);
  const visitWheres = new Map<string, Record<string, unknown>[]>();
  for (const [visitKey, visit] of byPath) {
    const wheres = await Promise.all(
      visit.whereClauses.map(async (clause: Condition) => {
        const plan = toPrisma(clause, { map: lens, mapName: visit.mapName, model: visit.modelName });
        const step = plan.steps[0];
        const where =
          plan.steps.length === 1 && step && 'where' in step
            ? step.where
            : await executePrismaQueryPlan(plan, db as never);
        if (Object.keys(where).length === 0) {
          throw makeError({
            status: 500,
            message: `Narrowing where at '${visitKey}' does not compile to a Prisma filter (bridge conditions are unsupported in row scope)`,
          });
        }
        return where;
      }),
    );
    // Live scope: every visited model with a `deletedAt` column reads live rows
    // only. An explicit `deletedAt` at the node (lens where, caller where at the
    // root, or client searchFields) wins; superadmin skips injection entirely.
    if (
      !includeSoftDeleted &&
      hasSoftDelete(visit.modelName) &&
      !explicitDeletedAtVisits.has(visitKey) &&
      !wheres.some(mentionsDeletedAt)
    ) {
      wheres.push({ deletedAt: null });
    }
    if (wheres.length) visitWheres.set(visitKey, wheres);
  }
  const visitWhere: VisitWhereFn = (visitKey) => visitWheres.get(visitKey) ?? [];

  // Global search — broad: each searchable field contributes a clause based on its
  // kind (String→contains, String[]→has, Json→string_contains); non-text fields skip.
  if (search && searchableFields.length) {
    const searchConditions = searchableFields.flatMap((field) => {
      const def = lookupField(model, stripRelationOperators(field));
      const clause = def && buildSearchClause(def, search);
      if (!clause) return [];
      if (!validatePathNotation(field)) throw makeError({ status: 400, message: `Invalid searchable field: ${field}` });
      return [buildSearchPath(model, field, clause, visitWhere)];
    });
    if (searchConditions.length) conditions.push({ OR: searchConditions });
  }

  if (searchFields && (searchableFields.length || skipFieldValidation)) {
    const transformed = validateAndTransformSearchFields(
      searchFields,
      searchableFields,
      skipFieldValidation,
      model,
      visitWhere,
    );
    for (const [key, value] of Object.entries(transformed)) {
      if (orNullFields.includes(key)) {
        conditions.push({ OR: [{ [key]: value }, { [key]: null }] });
      } else {
        conditions.push({ [key]: value });
      }
    }
  }

  conditions.push(...visitWhere(model));

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
