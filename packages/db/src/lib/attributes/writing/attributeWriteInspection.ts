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
import type { AttributeWriteInspection } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import {
  ATTRIBUTE_COLUMN_NAMES,
  type AttributeFieldDefinition,
  type AttributeValueType,
  attributeTypedColumnIssues,
  deduplicateMultiSelect,
  isAttributeValueType,
  populatedAttributeColumns,
} from '@template/shared/attributes';

export type AttributeWriteInspectionOptions = {
  resolveDefinition?: (locator: string) => AttributeFieldDefinition | undefined;
};

/**
 * Inspects an Attribute row write (create or merged update) without throwing:
 * - Always enforces the Layer 1 invariant (at most one of the 5 typed columns populated; never Prisma.JsonNull).
 * - If `resolveDefinition` is configured on the model (or passed via options), checks locator,
 *   `resourceModel`, exact typed column match, optional Zod `schema`, and normalizes `multiSelect`/`date`.
 * - Never mutates or deduplicates plain `json` arrays or generic Layer 1 `valueJson` payloads.
 */
export const attributeWriteInspection = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
  options?: AttributeWriteInspectionOptions,
): AttributeWriteInspection => {
  const config = attributeModelConfig(model);
  const resolveDefinition = options?.resolveDefinition ?? config.resolveDefinition;
  const columns = toProtocolColumns(row);
  const errors: string[] = [];

  if (columns.valueJson === Prisma.JsonNull) {
    errors.push(
      `${config.model}.valueJson: Prisma.JsonNull is not allowed; use Prisma.DbNull to store SQL NULL`,
    );
  }

  let definition: AttributeFieldDefinition | undefined;
  if (config.locatorField) {
    const locator = row[config.locatorField];
    if (typeof locator !== 'string' || !locator) {
      return {
        ok: false,
        errors: [`${config.model}.${config.locatorField} must be a non-empty string`],
      };
    }

    if (resolveDefinition) {
      definition = resolveDefinition(locator);
      if (!definition) {
        return {
          ok: false,
          errors: [`Unknown ${config.model} ${config.locatorField} '${locator}'`],
        };
      }

      if (config.resourceModelField && definition.resourceModels?.length) {
        const resourceModel = row[config.resourceModelField];
        if (
          typeof resourceModel !== 'string' ||
          !definition.resourceModels.includes(resourceModel)
        ) {
          errors.push(
            `${config.model} ${config.locatorField} '${locator}' is not valid for ${config.resourceModelField}='${String(resourceModel)}' (allowed: ${definition.resourceModels.join(', ')})`,
          );
        }
      }
    }
  }

  const rowValueType = config.valueTypeField ? row[config.valueTypeField] : undefined;
  if (config.valueTypeField && rowValueType !== undefined && !isAttributeValueType(rowValueType)) {
    errors.push(
      `${config.model}.${config.valueTypeField} must be a valid AttributeValueType (got '${String(rowValueType)}')`,
    );
  }

  const effectiveValueType =
    definition?.valueType ??
    (isAttributeValueType(rowValueType) ? (rowValueType as AttributeValueType) : undefined);

  if (effectiveValueType) {
    const typedResult = attributeTypedColumnIssues(effectiveValueType, columns, definition?.schema);
    if (!typedResult.ok) {
      for (const issue of typedResult.issues) errors.push(issue.message);
    }
    if (errors.length > 0 || !typedResult.ok) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      value: typedResult.value,
      definition,
      ...(effectiveValueType === 'multiSelect'
        ? { normalizedValueJson: deduplicateMultiSelect(typedResult.value as string[]) }
        : {}),
      ...(effectiveValueType === 'date' ? { normalizedValueDate: typedResult.value as Date } : {}),
    };
  }

  const populated = populatedAttributeColumns(columns);
  if (populated.length > 1) {
    errors.push(
      `${config.model}: at most one typed attribute column (${ATTRIBUTE_COLUMN_NAMES.join(', ')}) may be populated; found ${populated.join(', ')}`,
    );
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: unpackAttributeValue(row),
  };
};
