/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import {
  ATTRIBUTE_COLUMN_NAMES,
  ATTRIBUTE_VALUE_TYPES,
  type AttributeFieldDefinition,
  type AttributeTypedColumns,
  type AttributeValueType,
  attributeColumnForValueType,
  attributeTypedColumnIssues,
  decodeAttributeColumnValue,
  deduplicateMultiSelect,
  encodeAttributeValue,
  populatedAttributeColumns,
} from '@template/shared/attributes';

// Only Prisma.DbNull represents SQL NULL; Prisma.JsonNull is a populated JSONB null value.
const unwrapPrismaDbNull = (value: unknown): unknown => (value === Prisma.DbNull ? null : value);

const isAttributeValueType = (value: unknown): value is AttributeValueType =>
  typeof value === 'string' && (ATTRIBUTE_VALUE_TYPES as readonly string[]).includes(value);

const toProtocolColumns = (row: Record<string, unknown>): Partial<AttributeTypedColumns> => ({
  valueBoolean: unwrapPrismaDbNull(row.valueBoolean) as boolean | null,
  valueText: unwrapPrismaDbNull(row.valueText) as string | null,
  valueNumber: unwrapPrismaDbNull(row.valueNumber) as number | null,
  valueDate: unwrapPrismaDbNull(row.valueDate) as Date | string | null,
  valueJson: unwrapPrismaDbNull(row.valueJson),
});

export type PrismaAttributeColumnPayload = {
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
};

const toPrismaColumnPayload = (
  encoded: ReturnType<typeof encodeAttributeValue>,
): PrismaAttributeColumnPayload => ({
  valueBoolean: encoded.valueBoolean,
  valueText: encoded.valueText,
  valueNumber: encoded.valueNumber,
  valueDate: encoded.valueDate,
  // Prisma 7 requires Prisma.DbNull to store SQL NULL in a nullable Json? column.
  valueJson:
    encoded.valueJson === null ? Prisma.DbNull : (encoded.valueJson as Prisma.InputJsonValue),
});

/** Packs a raw value into the 5 Prisma typed value columns for `valueType`, clearing sibling columns. */
export const packAttributeValue = (
  valueType: AttributeValueType,
  value: unknown,
): PrismaAttributeColumnPayload => toPrismaColumnPayload(encodeAttributeValue(valueType, value));

/**
 * Unpacks the populated value from a 5-column attribute row. If `valueType` is omitted, infers the
 * active column from whichever of the 5 typed columns is non-null.
 */
export const unpackAttributeValue = (
  row: Record<string, unknown>,
  valueType?: AttributeValueType,
): unknown => {
  const columns = toProtocolColumns(row);
  if (valueType) return decodeAttributeColumnValue(valueType, columns);
  const populated = populatedAttributeColumns(columns);
  if (populated.length === 0) return null;
  const active = populated[0];
  switch (active) {
    case 'valueBoolean':
      return decodeAttributeColumnValue('boolean', columns);
    case 'valueText':
      return decodeAttributeColumnValue('text', columns);
    case 'valueNumber':
      return decodeAttributeColumnValue('number', columns);
    case 'valueDate':
      return decodeAttributeColumnValue('date', columns);
    case 'valueJson':
      return columns.valueJson ?? null;
  }
};

/** Internal helper encoding a value when the config & definition have already been resolved. */
export const encodeResolvedAttributeColumns = (
  config: AttributeModelConfig,
  locator: string,
  definition: AttributeFieldDefinition | undefined,
  value: unknown,
  options?: { valueType?: AttributeValueType },
): PrismaAttributeColumnPayload => {
  const valueType = definition?.valueType ?? options?.valueType;
  if (!valueType) {
    throw new Error(
      `encodeAttributeColumns(${config.model}, '${locator}') requires a registered definition or explicit valueType`,
    );
  }

  const targetColumn = attributeColumnForValueType(valueType);
  const checked = attributeTypedColumnIssues(
    valueType,
    { [targetColumn]: value },
    definition?.schema,
  );
  if (!checked.ok) {
    throw new Error(
      `Invalid value for ${config.model}.${locator}: ${checked.issues.map((issue) => issue.message).join('; ')}`,
    );
  }
  return toPrismaColumnPayload(checked.columns);
};

/**
 * Validates `value` against the model's registered definition (when present) or explicit
 * `valueType`, deduplicates `multiSelect` arrays, and returns the 5-column Prisma payload.
 */
export const encodeAttributeColumns = (
  model: AttributeModelName | ModelName,
  locator: string,
  value: unknown,
  options?: { valueType?: AttributeValueType },
): PrismaAttributeColumnPayload => {
  const config = attributeModelConfig(model);
  const definition = config.resolveDefinition ? config.resolveDefinition(locator) : undefined;

  if (config.resolveDefinition && !definition) {
    throw new Error(`Unknown attribute locator '${locator}' for model '${config.model}'`);
  }

  return encodeResolvedAttributeColumns(config, locator, definition, value, options);
};

/**
 * Decodes the stored typed value from an Attribute row, ignoring `disabled` / `defaultValue`.
 * Returns `null` when unset.
 */
export const decodeStoredAttributeValue = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
  options?: { valueType?: AttributeValueType },
): unknown => {
  const config = attributeModelConfig(model);
  const locator = config.locatorField ? row[config.locatorField] : undefined;
  const definition =
    typeof locator === 'string' && config.resolveDefinition
      ? config.resolveDefinition(locator)
      : undefined;
  const rowValueType =
    config.valueTypeField && isAttributeValueType(row[config.valueTypeField])
      ? (row[config.valueTypeField] as AttributeValueType)
      : undefined;
  const valueType = definition?.valueType ?? options?.valueType ?? rowValueType;
  return unpackAttributeValue(row, valueType);
};

/**
 * Decodes the effective value from an Attribute row: returns the active typed value when present
 * and enabled, or falls back to `definition.defaultValue` when disabled or unset.
 */
export const decodeAttributeValue = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
  options?: { valueType?: AttributeValueType },
): unknown => {
  const config = attributeModelConfig(model);
  const locator = config.locatorField ? row[config.locatorField] : undefined;
  const definition =
    typeof locator === 'string' && config.resolveDefinition
      ? config.resolveDefinition(locator)
      : undefined;

  if (config.resolveDefinition && typeof locator === 'string' && !definition) {
    throw new Error(`Unknown attribute locator '${locator}' for model '${config.model}'`);
  }

  if (config.disabledField && row[config.disabledField] === true) {
    return definition?.defaultValue ?? null;
  }

  const stored = decodeStoredAttributeValue(model, row, options);
  return stored === null ? (definition?.defaultValue ?? null) : stored;
};

export type AttributeWriteInspectionOk = {
  ok: true;
  value: unknown;
  definition?: AttributeFieldDefinition;
  normalizedValueJson?: string[];
  normalizedValueDate?: Date;
};

export type AttributeWriteInspection = AttributeWriteInspectionOk | { ok: false; errors: string[] };

/**
 * Inspects an Attribute row write (create or merged update) without throwing:
 * - Always enforces the Layer 1 invariant (at most one of the 5 typed columns populated; never Prisma.JsonNull).
 * - If `resolveDefinition` is configured on the model (e.g. `Setting`), checks locator,
 *   `resourceModel`, exact typed column match, Zod `schema`, and normalizes `multiSelect`/`date`.
 * - If `valueTypeField` is configured without a code registry, checks against that `valueType`.
 * - Never mutates or deduplicates plain `json` arrays or generic Layer 1 `valueJson` payloads.
 */
export const attributeWriteInspection = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
): AttributeWriteInspection => {
  const config = attributeModelConfig(model);
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

    if (config.resolveDefinition) {
      definition = config.resolveDefinition(locator);
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

  // Layer 1 generic values-table invariant (no code registry & no valueTypeField):
  // enforce at most one populated typed column across all 5 standard columns without mutating JSON payloads.
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

/** Validates an Attribute row write and throws an Error listing all issues on failure. */
export const validateAttributeWrite = (
  model: AttributeModelName | ModelName,
  row: Record<string, unknown>,
): AttributeWriteInspectionOk => {
  const result = attributeWriteInspection(model, row);
  if (!result.ok) {
    throw new Error(result.errors.join('; '));
  }
  return result;
};
