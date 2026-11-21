/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type {
  AttributeOperatorOptions,
  AttributeRange,
  AttributeSortDirection,
} from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import {
  type AttributeValueType,
  attributeColumnForValueType,
  deduplicateMultiSelect,
  isStringArray,
  parseAttributeDate,
} from '@template/shared/attributes';

type AnyAttributeModel = AttributeModelName | ModelName;

const resolveOperatorContext = (
  model: AnyAttributeModel,
  locator: string,
  options?: AttributeOperatorOptions,
): { locatorFilter: Record<string, string>; valueType: AttributeValueType } => {
  const config = attributeModelConfig(model);
  const definition = config.resolveDefinition ? config.resolveDefinition(locator) : undefined;

  if (config.resolveDefinition && !definition) {
    throw new Error(`Unknown attribute locator '${locator}' for model '${config.model}'`);
  }

  const valueType = definition?.valueType ?? options?.valueType;
  if (!valueType) {
    throw new Error(
      `Attribute operator on ${config.model}('${locator}') requires a registered definition or explicit valueType`,
    );
  }

  const locatorFilter = config.locatorField ? { [config.locatorField]: locator } : {};
  return { locatorFilter, valueType };
};

const validateScalarOperand = (
  opName: string,
  model: AnyAttributeModel,
  locator: string,
  valueType: 'boolean' | 'text' | 'number' | 'date',
  value: unknown,
): boolean | string | number | Date => {
  switch (valueType) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`${opName}(${model}, '${locator}') requires a boolean value`);
      }
      return value;
    case 'text':
      if (typeof value !== 'string') {
        throw new Error(`${opName}(${model}, '${locator}') requires a string value`);
      }
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${opName}(${model}, '${locator}') requires a finite number value`);
      }
      return value;
    case 'date': {
      const parsed = parseAttributeDate(value);
      if (!parsed) {
        throw new Error(
          `${opName}(${model}, '${locator}') requires a valid Date or ISO date string`,
        );
      }
      return parsed;
    }
  }
};

/**
 * Prisma `where` matching an exact attribute locator + typed column value (supports all 6 valueTypes).
 * For `multiSelect`, both stored values and query operands are canonically deduplicated and sorted,
 * so `['b', 'a']` matches stored `['a', 'b']`.
 */
export const attributeWhereEquals = (
  model: AnyAttributeModel,
  locator: string,
  value: unknown,
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType } = resolveOperatorContext(model, locator, options);
  const column = attributeColumnForValueType(valueType);

  if (valueType === 'multiSelect') {
    if (!isStringArray(value)) {
      throw new Error(
        `attributeWhereEquals(${model}, '${locator}') requires a string[] for multiSelect`,
      );
    }
    return { ...locatorFilter, [column]: { equals: deduplicateMultiSelect(value) } };
  }

  if (valueType === 'json') {
    if (value === null || value === undefined || value === Prisma.JsonNull) {
      throw new Error(
        `attributeWhereEquals(${model}, '${locator}') requires a non-null JSON value`,
      );
    }
    return { ...locatorFilter, [column]: { equals: value } };
  }

  const validated = validateScalarOperand('attributeWhereEquals', model, locator, valueType, value);
  return { ...locatorFilter, [column]: validated };
};

/** Prisma `where` matching an attribute whose scalar value (`boolean`, `text`, `number`, `date`) is in `values`. */
export const attributeWhereIn = (
  model: AnyAttributeModel,
  locator: string,
  values: readonly (boolean | string | number | Date)[],
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType } = resolveOperatorContext(model, locator, options);

  if (valueType === 'json' || valueType === 'multiSelect') {
    throw new Error(
      `attributeWhereIn(${model}, '${locator}') is only supported on scalar valueTypes (boolean, text, number, date); got '${valueType}'`,
    );
  }

  const column = attributeColumnForValueType(valueType);
  const validated = values.map((item) =>
    validateScalarOperand('attributeWhereIn', model, locator, valueType, item),
  );
  return { ...locatorFilter, [column]: { in: validated } };
};

/** Prisma `where` matching a `number` or `date` attribute within a `gt`/`gte`/`lt`/`lte` range. */
export const attributeWhereRange = (
  model: AnyAttributeModel,
  locator: string,
  range: AttributeRange,
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType } = resolveOperatorContext(model, locator, options);

  if (valueType !== 'number' && valueType !== 'date') {
    throw new Error(
      `attributeWhereRange(${model}, '${locator}') requires valueType 'number' or 'date', got '${valueType}'`,
    );
  }

  const column = attributeColumnForValueType(valueType);
  const filter: Record<string, number | Date> = {};

  for (const bound of ['gt', 'gte', 'lt', 'lte'] as const) {
    const raw = range[bound];
    if (raw === undefined) continue;
    filter[bound] = validateScalarOperand(
      `attributeWhereRange.${bound}`,
      model,
      locator,
      valueType,
      raw,
    ) as number | Date;
  }

  if (Object.keys(filter).length === 0) {
    throw new Error(
      `attributeWhereRange(${model}, '${locator}') requires at least one bound (gt/gte/lt/lte)`,
    );
  }

  return { ...locatorFilter, [column]: filter };
};

/**
 * Prisma `where` matching a `multiSelect` attribute containing `value` via Postgres `array_contains`
 * (`@>`), utilizing the GIN index on `valueJson`.
 */
export const attributeWhereMultiSelectContains = (
  model: AnyAttributeModel,
  locator: string,
  value: string,
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType } = resolveOperatorContext(model, locator, options);

  if (valueType !== 'multiSelect') {
    throw new Error(
      `attributeWhereMultiSelectContains(${model}, '${locator}') requires valueType 'multiSelect', got '${valueType}'`,
    );
  }

  return {
    ...locatorFilter,
    valueJson: { array_contains: [value] },
  };
};

/**
 * Prisma `where` matching a `multiSelect` attribute containing ALL of `values` via Postgres
 * `array_contains` (`@>`), utilizing the GIN index on `valueJson`.
 */
export const attributeWhereMultiSelectContainsAll = (
  model: AnyAttributeModel,
  locator: string,
  values: readonly string[],
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType } = resolveOperatorContext(model, locator, options);

  if (valueType !== 'multiSelect') {
    throw new Error(
      `attributeWhereMultiSelectContainsAll(${model}, '${locator}') requires valueType 'multiSelect', got '${valueType}'`,
    );
  }

  return {
    ...locatorFilter,
    valueJson: { array_contains: deduplicateMultiSelect(values) },
  };
};

/**
 * Prisma `where` matching a `multiSelect` attribute containing ANY of `values` via Postgres
 * `array_contains` (`@>`), each branch utilizing the GIN index on `valueJson`.
 */
export const attributeWhereMultiSelectContainsAny = (
  model: AnyAttributeModel,
  locator: string,
  values: readonly string[],
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType } = resolveOperatorContext(model, locator, options);

  if (valueType !== 'multiSelect') {
    throw new Error(
      `attributeWhereMultiSelectContainsAny(${model}, '${locator}') requires valueType 'multiSelect', got '${valueType}'`,
    );
  }

  const unique = deduplicateMultiSelect(values);
  if (unique.length === 0) {
    return { ...locatorFilter, id: { in: [] } };
  }

  return {
    ...locatorFilter,
    OR: unique.map((value) => ({
      valueJson: { array_contains: [value] },
    })),
  };
};

/** Prisma `orderBy` for a scalar attribute (`boolean`, `text`, `number`, or `date`). */
export const attributeOrderBy = (
  model: AnyAttributeModel,
  locator: string,
  direction: AttributeSortDirection = 'asc',
  options?: AttributeOperatorOptions,
): Record<string, AttributeSortDirection> => {
  const { valueType } = resolveOperatorContext(model, locator, options);

  if (valueType === 'json' || valueType === 'multiSelect') {
    throw new Error(
      `attributeOrderBy(${model}, '${locator}') is only supported on scalar valueTypes (boolean, text, number, date); got '${valueType}'`,
    );
  }

  return { [attributeColumnForValueType(valueType)]: direction };
};
