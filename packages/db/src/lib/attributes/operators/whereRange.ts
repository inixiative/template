/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AttributeModelName } from '@template/db/lib/attributes/registry';
import { resolveAttributeTarget } from '@template/db/lib/attributes/resolveAttributeTarget';
import type { AttributeOperatorOptions, AttributeRange } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import { parseAttributeValueOrThrow } from '@template/shared/attributes';

/** Prisma `where` matching a `number` or `date` attribute within a `gt`/`gte`/`lt`/`lte` range. */
export const attributeWhereRange = (
  model: AttributeModelName | ModelName,
  locator: string,
  range: AttributeRange,
  options?: AttributeOperatorOptions,
): Record<string, unknown> => {
  const { locatorFilter, valueType, column } = resolveAttributeTarget(model, locator, options);

  if (valueType !== 'number' && valueType !== 'date') {
    throw new Error(
      `attributeWhereRange(${model}, '${locator}') requires valueType 'number' or 'date', got '${valueType}'`,
    );
  }

  const filter: Record<string, number | Date> = {};
  for (const bound of ['gt', 'gte', 'lt', 'lte'] as const) {
    const raw = range[bound];
    if (raw === undefined) continue;
    filter[bound] = parseAttributeValueOrThrow(
      valueType,
      raw,
      `attributeWhereRange.${bound}(${model}, '${locator}')`,
    ) as number | Date;
  }

  if (Object.keys(filter).length === 0) {
    throw new Error(
      `attributeWhereRange(${model}, '${locator}') requires at least one bound (gt/gte/lt/lte)`,
    );
  }

  return { ...locatorFilter, [column]: filter };
};
