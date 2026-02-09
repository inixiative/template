import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';

type BuildWhereOptions = {
  search?: string;
  searchFields?: Record<string, any>;
  searchableFields?: string[];
  filters?: Record<string, any>;
};

const relationOperators = ['some', 'every', 'none', 'is', 'isNot'];
const fieldOperators = ['contains', 'equals', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'startsWith', 'endsWith', 'not'];

const validateAndTransformSearchFields = (
  obj: Record<string, any>,
  searchableFields: string[],
  prefix = '',
  autoContains = true,
  depth = 0,
): any => {
  // Prevent stack overflow from deeply nested or circular queries
  if (depth > 10) {
    throw new Error('Search query nesting too deep (max 10 levels)');
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      if (!validatePathNotation(currentPath)) {
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!searchableFields.includes(currentPath)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      result[key] = autoContains ? { contains: value, mode: 'insensitive' as const } : value;
    } else if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      if (!validatePathNotation(currentPath)) {
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!searchableFields.includes(currentPath)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      result[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      const hasRelationOperator = keys.some((k) => relationOperators.includes(k));
      const hasFieldOperator = keys.some((k) => fieldOperators.includes(k));

      if (hasRelationOperator) {
        result[key] = {};
        for (const [opKey, opValue] of Object.entries(value)) {
          if (relationOperators.includes(opKey) && typeof opValue === 'object') {
            result[key][opKey] = validateAndTransformSearchFields(
              opValue as Record<string, any>,
              searchableFields,
              currentPath,
              false,
              depth + 1,
            );
          }
        }
      } else if (hasFieldOperator) {
        if (!validatePathNotation(currentPath)) {
          throw new Error(`Invalid search field: ${currentPath}`);
        }
        if (!searchableFields.includes(currentPath)) {
          throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
        }
        result[key] = value;
      } else {
        result[key] = validateAndTransformSearchFields(value, searchableFields, currentPath, autoContains, depth + 1);
      }
    }
  }

  return result;
};

export const buildWhereClause = (options: BuildWhereOptions): any => {
  const { search, searchFields, searchableFields = [], filters = {} } = options;
  const conditions: any[] = [];

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
    const transformed = validateAndTransformSearchFields(searchFields, searchableFields);
    for (const [key, value] of Object.entries(transformed)) {
      conditions.push({ [key]: value });
    }
  }

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
