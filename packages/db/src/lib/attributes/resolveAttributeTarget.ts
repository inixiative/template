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
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import {
  type AttributeColumnName,
  type AttributeFieldDefinition,
  type AttributeValueType,
  attributeColumnForValueType,
} from '@template/shared/attributes';

export type ResolveAttributeTargetOptions = {
  valueType?: AttributeValueType;
  definition?: AttributeFieldDefinition;
  resourceModel?: string;
};

export type ResolvedAttributeTarget = {
  config: AttributeModelConfig;
  definition?: AttributeFieldDefinition;
  locatorFilter: Record<string, string>;
  valueType: AttributeValueType;
  column: AttributeColumnName;
};

/**
 * Single shared resolver for attribute writing and query operators.
 * Looks up `ATTRIBUTE_MODELS` config, resolves the definition (code registry or caller-supplied
 * Layer 2 definition), validates optional `resourceModel`, and returns `{ config, definition,
 * locatorFilter, valueType, column }`.
 */
export const resolveAttributeTarget = (
  model: AttributeModelName | ModelName,
  locator: string,
  options?: ResolveAttributeTargetOptions,
): ResolvedAttributeTarget => {
  const config = attributeModelConfig(model);
  const definition =
    options?.definition ??
    (config.resolveDefinition ? config.resolveDefinition(locator) : undefined);

  if (!options?.definition && config.resolveDefinition && !definition) {
    throw new Error(`Unknown attribute locator '${locator}' for model '${config.model}'`);
  }

  if (
    options?.resourceModel &&
    definition?.resourceModels?.length &&
    !definition.resourceModels.includes(options.resourceModel)
  ) {
    throw new Error(
      `${config.model} '${locator}' is not valid for resourceModel '${options.resourceModel}'`,
    );
  }

  const valueType = definition?.valueType ?? options?.valueType;
  if (!valueType) {
    throw new Error(
      `Attribute operation on ${config.model}('${locator}') requires a registered definition or explicit valueType`,
    );
  }

  const locatorFilter = config.locatorField ? { [config.locatorField]: locator } : {};
  return {
    config,
    definition,
    locatorFilter,
    valueType,
    column: attributeColumnForValueType(valueType),
  };
};
