/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import type { AttributeColumnName } from '@template/shared/attributes';

/** Uniform required 5-column Prisma scalar contract for every model in ATTRIBUTE_MODELS. */
const EXPECTED_ATTRIBUTE_COLUMN_TYPES: Record<AttributeColumnName, string> = {
  valueBoolean: 'Boolean',
  valueText: 'String',
  valueNumber: 'Float',
  valueDate: 'DateTime',
  valueJson: 'Json',
};

/** Checks configured optional metadata columns and the uniform 5-column typed contract on `modelName`. */
export const checkAttributeColumns = (
  modelName: ModelName,
  config: AttributeModelConfig,
): string[] => {
  const errors: string[] = [];

  if (config.locatorField) {
    const locator = fieldOf(prismaMap, modelName, config.locatorField);
    if (!locator || (locator.kind !== 'scalar' && locator.kind !== 'enum') || !locator.isRequired) {
      errors.push(
        `${modelName}.${config.locatorField}: locatorField must be a required scalar or enum column`,
      );
    }
  }

  if (config.valueTypeField) {
    const valueTypeCol = fieldOf(prismaMap, modelName, config.valueTypeField);
    if (!valueTypeCol || (valueTypeCol.kind !== 'scalar' && valueTypeCol.kind !== 'enum')) {
      errors.push(
        `${modelName}.${config.valueTypeField}: valueTypeField must be a scalar or enum column`,
      );
    }
  }

  if (config.resourceModelField) {
    const resourceField = fieldOf(prismaMap, modelName, config.resourceModelField);
    if (
      !resourceField ||
      (resourceField.kind !== 'enum' && resourceField.kind !== 'scalar') ||
      !resourceField.isRequired
    ) {
      errors.push(
        `${modelName}.${config.resourceModelField}: resourceModelField must be a required enum or scalar column`,
      );
    }
  }

  if (config.disabledField) {
    const disabledField = fieldOf(prismaMap, modelName, config.disabledField);
    if (disabledField?.kind !== 'scalar' || disabledField.type !== 'Boolean') {
      errors.push(
        `${modelName}.${config.disabledField}: disabledField must be a Boolean scalar column`,
      );
    }
  }

  for (const [columnName, expectedType] of Object.entries(EXPECTED_ATTRIBUTE_COLUMN_TYPES) as [
    AttributeColumnName,
    string,
  ][]) {
    const column = fieldOf(prismaMap, modelName, columnName);
    if (!column) {
      errors.push(
        `${modelName}.${columnName}: missing required Attribute typed column (${expectedType}?)`,
      );
      continue;
    }
    if (column.kind !== 'scalar' || column.type !== expectedType) {
      errors.push(
        `${modelName}.${columnName}: expected Prisma type ${expectedType}?, got ${column.kind}:${column.type}`,
      );
    }
    if (column.isList) {
      errors.push(
        `${modelName}.${columnName}: Attribute typed value column must be a single nullable scalar, not a list`,
      );
    }
    if (column.isRequired) {
      errors.push(
        `${modelName}.${columnName}: Attribute typed value column must be optional (nullable) so sibling value columns stay null`,
      );
    }
  }

  return errors;
};
