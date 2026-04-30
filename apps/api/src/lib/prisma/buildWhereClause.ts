import type { ModelName } from '@template/db';
import { FIELD_OPERATORS, isArrayFieldOperator, isRelationOperator } from '@template/shared/bracketQuery';
import { isEnumPath } from '#/lib/prisma/fieldMetadata';
import { buildNestedPath, validatePathNotation } from '#/lib/prisma/pathNotation';
import type { BracketQueryPrimitive, BracketQueryRecord, BracketQueryValue } from '#/lib/utils/parseBracketNotation';

type BuildWhereOptions = {
  // Root model the searchable paths are rooted in. When provided, enum
  // columns are detected via prismaMap and emit exact equality (Prisma
  // rejects { contains, mode } on enums); when omitted, every searchable
  // field is treated as a string.
  model?: ModelName;
  search?: string;
  searchFields?: BracketQueryRecord;
  searchableFields?: readonly string[];
  skipFieldValidation?: boolean;
  filters?: Record<string, unknown>;
  orNullFields?: string[];
};

const isBracketQueryRecord = (value: BracketQueryValue | undefined): value is BracketQueryRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBracketQueryPrimitive = (value: BracketQueryValue): value is BracketQueryPrimitive =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;

const validateFieldOperatorValue = (fieldPath: string, operator: string, value: BracketQueryValue) => {
  const expectsArray = isArrayFieldOperator(operator);
  const isArray = Array.isArray(value);

  if (expectsArray) {
    if (isArray) {
      if (!value.every(isBracketQueryPrimitive)) {
        throw new Error(`Operator '${operator}' on field '${fieldPath}' requires primitive values`);
      }
      return;
    }

    if (!isBracketQueryPrimitive(value)) {
      throw new Error(`Operator '${operator}' on field '${fieldPath}' requires primitive values`);
    }
    return;
  }

  if (isArray) {
    throw new Error(`Operator '${operator}' on field '${fieldPath}' does not support array values`);
  }

  if (!isBracketQueryPrimitive(value)) {
    throw new Error(`Operator '${operator}' on field '${fieldPath}' requires a primitive value`);
  }
};

const validateAndTransformSearchFields = (
  obj: BracketQueryRecord,
  searchableFields: readonly string[],
  skipFieldValidation: boolean,
  model: ModelName | undefined,
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
      // Enum columns can't take { contains, mode } — emit exact equality.
      const isEnum = model ? isEnumPath(model, currentPath) : false;
      result[key] = autoContains && !isEnum ? { contains: value, mode: 'insensitive' as const } : value;
    } else if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      if (!validatePathNotation(currentPath)) {
        throw new Error(`Invalid search field: ${currentPath}`);
      }
      if (!skipFieldValidation && !searchableFields.includes(currentPath)) {
        throw new Error(`Field '${currentPath}' is not searchable. Allowed fields: ${searchableFields.join(', ')}`);
      }
      result[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        throw new Error(`Field '${currentPath}' does not support array values without an operator`);
      }

      const keys = Object.keys(value);
      const hasRelationOperator = keys.some((k) => isRelationOperator(k));
      const hasFieldOperator = keys.some((k) => (FIELD_OPERATORS as readonly string[]).includes(k));

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
          if (isRelationOperator(opKey) && isBracketQueryRecord(opValue)) {
            relationValue[opKey] = validateAndTransformSearchFields(
              opValue,
              searchableFields,
              skipFieldValidation,
              model,
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

        const normalizedOperators = { ...value };
        for (const [operator, operatorValue] of Object.entries(value)) {
          if ((FIELD_OPERATORS as readonly string[]).includes(operator) && operatorValue !== undefined) {
            validateFieldOperatorValue(currentPath, operator, operatorValue);
            if (isArrayFieldOperator(operator) && !Array.isArray(operatorValue)) {
              normalizedOperators[operator] = [operatorValue as BracketQueryPrimitive];
            }
          }
        }
        result[key] = normalizedOperators;
      } else {
        result[key] = validateAndTransformSearchFields(
          value,
          searchableFields,
          skipFieldValidation,
          model,
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
  const {
    model,
    search,
    searchFields,
    searchableFields = [],
    skipFieldValidation = false,
    filters = {},
    orNullFields = [],
  } = options;
  const conditions: Record<string, unknown>[] = [];

  if (search && searchableFields.length) {
    // Skip enum fields in the global search OR — substring-match against
    // an enum is meaningless and Prisma rejects { contains, mode } on
    // enum columns at runtime. Without a model, we can't tell, so include
    // every field (no enum filtering).
    const stringFields = model ? searchableFields.filter((f) => !isEnumPath(model, f)) : searchableFields;
    if (stringFields.length) {
      const searchConditions = stringFields.map((field) => {
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

  return {
    ...filters,
    ...(conditions.length > 0 ? { AND: conditions } : {}),
  };
};
