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
import { parseAttributeValue } from '@template/shared/attributes';

/** Prisma `where` matching an attribute whose scalar value (`boolean`, `text`, `number`, `date`) is in `values`. */
export const attributeWhereIn = (
  model: AttributeModelName | ModelName,
  locator: string,
  values: readonly (boolean | string | number | Date)[],
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType, column } = resolveAttributeTarget(model, locator, options);

  if (valueType === 'json' || valueType === 'multiSelect') {
    throw new Error(
      `attributeWhereIn(${model}, '${locator}') is only supported on scalar valueTypes (boolean, text, number, date); got '${valueType}'`,
    );
  }

  const parsed = values.map((item) =>
    parseAttributeValue(valueType, item, `attributeWhereIn(${model}, '${locator}')`),
  );
  return { ...locatorFilter, [column]: { in: parsed } };
};
