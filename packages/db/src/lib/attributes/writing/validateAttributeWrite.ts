/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import { toProtocolColumns } from '@template/db/lib/attributes/parsing/toProtocolColumns';
import { unpackAttributeValue } from '@template/db/lib/attributes/parsing/unpackAttributeValue';
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type { ValidatedAttributeWrite } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import {
  ATTRIBUTE_COLUMN_NAMES,
  type AttributeFieldDefinition,
  AttributeValidationError,
  type AttributeValueType,
  isAttributeValueType,
  populatedAttributeColumns,
  validateAttributeTypedColumns,
} from '@template/shared/attributes';

export type ValidateAttributeWriteOptions = {
  resolveDefinition?: (locator: string) => AttributeFieldDefinition | undefined;
};

/**
 * Validates an Attribute row write (create or merged update) and throws `AttributeValidationError`
 * on violation:
 * - Enforces the Layer 1 invariant (at most one of the 5 typed columns populated; never Prisma.JsonNull).
 * - If `resolveDefinition` is configured on the model (or passed via options), checks the locator,
 *   exact typed column match, `options` and `conditions`, and normalizes `multiSelect`/`date`.
 */
export const validateAttributeWrite = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
  options?: ValidateAttributeWriteOptions,
): ValidatedAttributeWrite => {
  const config = attributeModelConfig(model);
  const resolveDefinition = options?.resolveDefinition ?? config.resolveDefinition;
  const columns = toProtocolColumns(row);

  if (columns.valueJson === Prisma.JsonNull) {
    throw new AttributeValidationError([
      {
        code: 'invalid_attribute_json_null',
        message: `${config.model}.valueJson: Prisma.JsonNull is not allowed; use Prisma.DbNull to store SQL NULL`,
        path: ['valueJson'],
      },
    ]);
  }

  let definition: AttributeFieldDefinition | undefined;
  if (config.locatorField) {
    const locator = row[config.locatorField];
    if (typeof locator !== 'string' || !locator) {
      throw new AttributeValidationError([
        {
          code: 'invalid_attribute_locator',
          message: `${config.model}.${config.locatorField} must be a non-empty string`,
          path: [config.locatorField],
        },
      ]);
    }

    if (resolveDefinition) {
      definition = resolveDefinition(locator);
      if (!definition) {
        throw new AttributeValidationError([
          {
            code: 'unknown_attribute_locator',
            message: `Unknown ${config.model} ${config.locatorField} '${locator}'`,
            path: [config.locatorField],
          },
        ]);
      }
    }
  }

  const rowValueType = config.valueTypeField ? row[config.valueTypeField] : undefined;
  if (config.valueTypeField && rowValueType !== undefined && !isAttributeValueType(rowValueType)) {
    throw new AttributeValidationError([
      {
        code: 'invalid_attribute_value_type',
        message: `${config.model}.${config.valueTypeField} must be a valid AttributeValueType (got '${String(rowValueType)}')`,
        path: [config.valueTypeField],
      },
    ]);
  }

  const effectiveValueType =
    definition?.valueType ??
    (isAttributeValueType(rowValueType) ? (rowValueType as AttributeValueType) : undefined);

  if (effectiveValueType) {
    const value = validateAttributeTypedColumns(effectiveValueType, columns, definition);
    return {
      value,
      definition,
      ...(effectiveValueType === 'multiSelect' ? { normalizedValueJson: value as string[] } : {}),
      ...(effectiveValueType === 'date' ? { normalizedValueDate: value as Date } : {}),
    };
  }

  const populated = populatedAttributeColumns(columns);
  if (populated.length > 1) {
    throw new AttributeValidationError([
      {
        code: 'multiple_attribute_columns',
        message: `${config.model}: at most one typed attribute column (${ATTRIBUTE_COLUMN_NAMES.join(', ')}) may be populated; found ${populated.join(', ')}`,
      },
    ]);
  }

  return { value: unpackAttributeValue(row) };
};
