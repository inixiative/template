/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import type { AttributeModelName } from '@template/db/lib/attributes/registry';
import { resolveAttributeTarget } from '@template/db/lib/attributes/resolveAttributeTarget';
import type { AttributeOperatorOptions } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import { parseAttributeValue } from '@template/shared/attributes';

/**
 * Prisma `where` matching an exact attribute locator + typed column value (supports all 6 valueTypes).
 * For `multiSelect`, both stored values and query operands are canonically deduplicated and sorted,
 * so `['b', 'a']` matches stored `['a', 'b']`.
 */
export const attributeWhereEquals = (
  model: AttributeModelName | ModelName,
  locator: string,
  value: unknown,
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType, column } = resolveAttributeTarget(model, locator, options);

  if (valueType === 'json' && value === Prisma.JsonNull) {
    throw new Error(
      `attributeWhereEquals(${model}, '${locator}'): Expected non-null JSON value for attribute valueType 'json'`,
    );
  }

  const parsed = parseAttributeValue(
    valueType,
    value,
    `attributeWhereEquals(${model}, '${locator}')`,
  );

  if (valueType === 'multiSelect' || valueType === 'json') {
    return { ...locatorFilter, [column]: { equals: parsed } };
  }

  return { ...locatorFilter, [column]: parsed };
};
