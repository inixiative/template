/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AttributeModelName } from '@template/db/lib/attributes/registry';
import { resolveAttributeTarget } from '@template/db/lib/attributes/resolveAttributeTarget';
import type { AttributeOperatorOptions } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import { deduplicateMultiSelect } from '@template/shared/attributes';

const requireMultiSelectTarget = (
  opName: string,
  model: AttributeModelName | ModelName,
  locator: string,
  options?: AttributeOperatorOptions,
) => {
  const target = resolveAttributeTarget(model, locator, options);
  if (target.valueType !== 'multiSelect') {
    throw new Error(
      `${opName}(${model}, '${locator}') requires valueType 'multiSelect', got '${target.valueType}'`,
    );
  }
  return target;
};

/**
 * Prisma `where` matching a `multiSelect` attribute containing `value` via Postgres `array_contains`
 * (`@>`), utilizing the GIN index on `valueJson`.
 */
export const attributeWhereMultiSelectContains = (
  model: AttributeModelName | ModelName,
  locator: string,
  value: string,
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter } = requireMultiSelectTarget(
    'attributeWhereMultiSelectContains',
    model,
    locator,
    options,
  );
  return { ...locatorFilter, valueJson: { array_contains: [value] } };
};

/**
 * Prisma `where` matching a `multiSelect` attribute containing ALL of `values` via Postgres
 * `array_contains` (`@>`), utilizing the GIN index on `valueJson`.
 */
export const attributeWhereMultiSelectContainsAll = (
  model: AttributeModelName | ModelName,
  locator: string,
  values: readonly string[],
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter } = requireMultiSelectTarget(
    'attributeWhereMultiSelectContainsAll',
    model,
    locator,
    options,
  );
  return { ...locatorFilter, valueJson: { array_contains: deduplicateMultiSelect(values) } };
};

/**
 * Prisma `where` matching a `multiSelect` attribute containing ANY of `values` via Postgres
 * `array_contains` (`@>`), each branch utilizing the GIN index on `valueJson`.
 */
export const attributeWhereMultiSelectContainsAny = (
  model: AttributeModelName | ModelName,
  locator: string,
  values: readonly string[],
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter } = requireMultiSelectTarget(
    'attributeWhereMultiSelectContainsAny',
    model,
    locator,
    options,
  );
  const unique = deduplicateMultiSelect(values);
  if (unique.length === 0) {
    return { ...locatorFilter, id: { in: [] } };
  }
  return {
    ...locatorFilter,
    OR: unique.map((value) => ({ valueJson: { array_contains: [value] } })),
  };
};
