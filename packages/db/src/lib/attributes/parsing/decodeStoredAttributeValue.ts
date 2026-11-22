/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { unpackAttributeValue } from '@template/db/lib/attributes/parsing/unpackAttributeValue';
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type { ModelName } from '@template/db/utils/modelNames';
import {
  type AttributeFieldDefinition,
  type AttributeValueType,
  isAttributeValueType,
} from '@template/shared/attributes';

/**
 * Decodes the stored typed value from an Attribute row, ignoring `disabled` / `defaultValue`.
 * Returns `null` when unset.
 */
export const decodeStoredAttributeValue = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
  options?: { valueType?: AttributeValueType; definition?: AttributeFieldDefinition },
): unknown => {
  const config = attributeModelConfig(model);
  const locator = config.locatorField ? row[config.locatorField] : undefined;
  const definition =
    options?.definition ??
    (typeof locator === 'string' && config.resolveDefinition
      ? config.resolveDefinition(locator)
      : undefined);
  const rowValueType =
    config.valueTypeField && isAttributeValueType(row[config.valueTypeField])
      ? (row[config.valueTypeField] as AttributeValueType)
      : undefined;
  const valueType = definition?.valueType ?? options?.valueType ?? rowValueType;
  return unpackAttributeValue(row, valueType);
};
