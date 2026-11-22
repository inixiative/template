/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AttributeModelName } from '@template/db/lib/attributes/registry';
import { resolveAttributeTarget } from '@template/db/lib/attributes/resolveAttributeTarget';
import type {
  AttributeOperatorOptions,
  AttributeSortDirection,
} from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';

/** Prisma `orderBy` for a scalar attribute (`boolean`, `text`, `number`, or `date`). */
export const attributeOrderBy = (
  model: AttributeModelName | ModelName,
  locator: string,
  direction: AttributeSortDirection = 'asc',
  options?: AttributeOperatorOptions,
): Record<string, AttributeSortDirection> => {
  const { valueType, column } = resolveAttributeTarget(model, locator, options);

  if (valueType === 'json' || valueType === 'multiSelect') {
    throw new Error(
      `attributeOrderBy(${model}, '${locator}') is only supported on scalar valueTypes (boolean, text, number, date); got '${valueType}'`,
    );
  }

  return { [column]: direction };
};
