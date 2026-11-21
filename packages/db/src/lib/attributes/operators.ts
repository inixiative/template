/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type {
  AttributeOperatorOptions,
  AttributeRange,
  AttributeSortDirection,
} from '@template/db/lib/attributes/types';
import {
  type AttributeValueType,
  attributeColumnForValueType,
  deduplicateMultiSelect,
  parseAttributeDate,
} from '@template/shared/attributes';

const resolveOperatorContext = (
  model: AttributeModelName,
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

/** Prisma `where` matching an exact attribute locator + typed column value (supports all 6 valueTypes). */
export const attributeWhereEquals = (
  model: AttributeModelName,
  locator: string,
  value: unknown,
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType } = resolveOperatorContext(model, locator, options);
  const column = attributeColumnForValueType(valueType);

  if (valueType === 'multiSelect') {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      throw new Error(
        `attributeWhereEquals(${model}, '${locator}') requires a string[] for multiSelect`,
      );
    }
    return { ...locatorFilter, [column]: { equals: deduplicateMultiSelect(value) } };
  }

  if (valueType === 'date') {
    const parsed = parseAttributeDate(value);
    if (!parsed) {
      throw new Error(
        `attributeWhereEquals(${model}, '${locator}') requires a valid Date or ISO string for date`,
      );
    }
    return { ...locatorFilter, [column]: parsed };
  }

  if (valueType === 'json') {
    return { ...locatorFilter, [column]: { equals: value } };
  }

  return { ...locatorFilter, [column]: value };
};

/** Prisma `where` matching an attribute whose scalar value (`boolean`, `text`, `number`, `date`) is in `values`. */
export const attributeWhereIn = (
  model: AttributeModelName,
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
  if (valueType === 'date') {
    const parsedDates = values.map((item) => {
      const parsed = parseAttributeDate(item);
      if (!parsed) {
        throw new Error(
          `attributeWhereIn(${model}, '${locator}') received invalid date value '${String(item)}'`,
        );
      }
      return parsed;
    });
    return { ...locatorFilter, [column]: { in: parsedDates } };
  }

  return { ...locatorFilter, [column]: { in: [...values] } };
};

/** Prisma `where` matching a `number` or `date` attribute within a `gt`/`gte`/`lt`/`lte` range. */
export const attributeWhereRange = (
  model: AttributeModelName,
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
    if (valueType === 'date') {
      const parsed = parseAttributeDate(raw);
      if (!parsed) {
        throw new Error(
          `attributeWhereRange(${model}, '${locator}') received invalid date for '${bound}'`,
        );
      }
      filter[bound] = parsed;
    } else {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        throw new Error(
          `attributeWhereRange(${model}, '${locator}') requires finite number for '${bound}'`,
        );
      }
      filter[bound] = raw;
    }
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
  model: AttributeModelName,
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
  model: AttributeModelName,
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
  model: AttributeModelName,
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
  model: AttributeModelName,
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
