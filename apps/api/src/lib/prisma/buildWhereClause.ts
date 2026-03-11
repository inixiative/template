import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';
import type { BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type BuildWhereOptions = {
  search?: string;
  searchFields?: BracketQueryRecord;
  searchableFields?: readonly string[];
  adminSearchableFields?: readonly string[];
  filters?: Record<string, unknown>;
};

const relationOperators = ['some', 'every', 'none', 'is', 'isNot'];
const fieldOperators = ['contains', 'equals', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'startsWith', 'endsWith', 'not'];

const isBracketQueryRecord = (value: BracketQueryValue | undefined): value is BracketQueryRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFieldAllowed = (
  path: string,
  searchableFields: readonly string[],
  adminSearchableFields?: readonly string[],
): boolean => {
  if (searchableFields.includes(path)) return true;
  if (adminSearchableFields?.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))) return true;
  return false;
};

const isRelationAllowed = (
  path: string,
  searchableFields: readonly string[],
  adminSearchableFields?: readonly string[],
): boolean => {
  if (searchableFields.some((f) => f === path || f.startsWith(`${path}.`))) return true;
  if (adminSearchableFields?.some((prefix) => path === prefix || path.startsWith(`${prefix}.`) || prefix.startsWith(`${path}.`))) return true;
  return false;
};

const validateAndTransformSearchFields = (
  obj: BracketQueryRecord,
  searchableFields: readonly string[],
  adminSearchableFields?: readonly string[],
  prefix = '',
  autoContains = true,
  depth = 0,
): BracketQueryRecord => {
  // Prevent stack overflow from deeply nested or circular queries
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
      if (!isFieldAllowed(currentPath, searchableFields, adminSearchableFields)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      result[key] = autoContains ? { contains: value, mode: 'insensitive' as const } : value;
    } else if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      if (!validatePathNotation(currentPath)) {
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!isFieldAllowed(currentPath, searchableFields, adminSearchableFields)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      result[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      const hasRelationOperator = keys.some((k) => relationOperators.includes(k));
      const hasFieldOperator = keys.some((k) => fieldOperators.includes(k));

      if (hasRelationOperator) {
        if (!isRelationAllowed(currentPath, searchableFields, adminSearchableFields)) {
          throw new Error(`Relation '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
        }
        const relationValue: BracketQueryRecord = {};
        for (const [opKey, opValue] of Object.entries(value)) {
          if (relationOperators.includes(opKey) && isBracketQueryRecord(opValue)) {
            relationValue[opKey] = validateAndTransformSearchFields(
              opValue,
              searchableFields,
              adminSearchableFields,
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
        if (!isFieldAllowed(currentPath, searchableFields, adminSearchableFields)) {
          throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
        }
        result[key] = value;
      } else {
        result[key] = validateAndTransformSearchFields(value, searchableFields, adminSearchableFields, currentPath, autoContains, depth + 1);
      }
    }
  }

  return result;
};

export const buildWhereClause = (options: BuildWhereOptions): Record<string, unknown> => {
  const { search, searchFields, searchableFields = [], adminSearchableFields, filters = {} } = options;
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

  if (searchFields && searchableFields.length) {
    const transformed = validateAndTransformSearchFields(searchFields, searchableFields, adminSearchableFields);
    for (const [key, value] of Object.entries(transformed)) {
      conditions.push({ [key]: value });
    }
  }

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
