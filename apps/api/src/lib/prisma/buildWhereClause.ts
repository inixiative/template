import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';
import type { BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type BuildWhereOptions = {
  search?: string;
  searchFields?: BracketQueryRecord;
  searchableFields?: readonly string[];
  skipFieldValidation?: boolean;
  filters?: Record<string, unknown>;
};

const relationOperators = ['some', 'every', 'none', 'is', 'isNot'];
const fieldOperators = ['contains', 'equals', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'startsWith', 'endsWith', 'not'];

const isBracketQueryRecord = (value: BracketQueryValue | undefined): value is BracketQueryRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateAndTransformSearchFields = (
  obj: BracketQueryRecord,
  searchableFields: readonly string[],
  skipFieldValidation: boolean,
  prefix = '',
  autoContains = true,
  depth = 0,
): BracketQueryRecord => {
  if (depth > 10) {
    throw new Error('Search query nesting too deep (max 10 levels)');
  }

  const result: BracketQueryRecord = {};

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      if (!validatePathNotation(currentPath)) {
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      result[key] = autoContains ? { contains: value, mode: 'insensitive' as const } : value;
    } else if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      if (!validatePathNotation(currentPath)) {
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      result[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      const hasRelationOperator = keys.some((k) => relationOperators.includes(k));
      const hasFieldOperator = keys.some((k) => fieldOperators.includes(k));

      if (hasRelationOperator) {
        if (
          !skipFieldValidation &&
          !searchableFields.some((f) => f === currentPath || f.startsWith(`${currentPath}.`))
        ) {
          throw new Error(
            `Relation '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`,
          );
        }
        const relationValue: BracketQueryRecord = {};
        for (const [opKey, opValue] of Object.entries(value)) {
          if (relationOperators.includes(opKey) && isBracketQueryRecord(opValue)) {
            relationValue[opKey] = validateAndTransformSearchFields(
              opValue,
              searchableFields,
              skipFieldValidation,
              currentPath,
              false,
              depth + 1,
            );
          }
        }
        result[key] = relationValue;
      } else if (hasFieldOperator) {
        if (!validatePathNotation(currentPath)) {
          throw new Error(`Invalid search field: ${currentPath}`);
        }
        if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
          throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
        }
        result[key] = value;
      } else {
        result[key] = validateAndTransformSearchFields(
          value,
          searchableFields,
          skipFieldValidation,
          currentPath,
          autoContains,
          depth + 1,
        );
      }
    }
  }

  return result;
};

export const buildWhereClause = (options: BuildWhereOptions): Record<string, unknown> => {
  const { search, searchFields, searchableFields = [], skipFieldValidation = false, filters = {} } = options;
  const conditions: Record<string, unknown>[] = [];

  if (search && searchableFields.length) {
    const searchConditions = searchableFields.map((field) => {
      if (!validatePathNotation(field)) {
        throw new Error(`Invalid searchable field: ${field}`);
      }

      return buildNestedPath(field, {
        contains: search,
        mode: 'insensitive' as const,
      });
    });
    conditions.push({ OR: searchConditions });
  }

  if (searchFields && (searchableFields.length || skipFieldValidation)) {
    const transformed = validateAndTransformSearchFields(searchFields, searchableFields, skipFieldValidation);
    for (const [key, value] of Object.entries(transformed)) {
      conditions.push({ [key]: value });
    }
  }

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
