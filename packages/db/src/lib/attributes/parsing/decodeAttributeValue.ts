/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { decodeStoredAttributeValue } from '@template/db/lib/attributes/parsing/decodeStoredAttributeValue';
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type { ModelName } from '@template/db/utils/modelNames';
import type { AttributeFieldDefinition, AttributeValueType } from '@template/shared/attributes';

/**
 * Decodes the effective value from an Attribute row: returns the active typed value when present
 * and enabled, or falls back to `definition.defaultValue` when disabled or unset.
 */
export const decodeAttributeValue = (
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

  if (
    !options?.definition &&
    config.resolveDefinition &&
    typeof locator === 'string' &&
    !definition
  ) {
    throw new Error(`Unknown attribute locator '${locator}' for model '${config.model}'`);
  }

  if (config.disabledField && row[config.disabledField] === true) {
    return definition?.defaultValue ?? null;
  }

  const stored = decodeStoredAttributeValue(model, row, options);
  return stored === null ? (definition?.defaultValue ?? null) : stored;
};
