/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldOf, modelOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { ATTRIBUTE_MODELS } from '@template/db/lib/attributes/registry';
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';
import { toModelName } from '@template/db/utils/modelNames';
import type { AttributeColumnName } from '@template/shared/attributes';

/** Uniform required 5-column Prisma scalar contract for every model in ATTRIBUTE_MODELS. */
const EXPECTED_ATTRIBUTE_COLUMN_TYPES: Record<AttributeColumnName, string> = {
  valueBoolean: 'Boolean',
  valueText: 'String',
  valueNumber: 'Float',
  valueDate: 'DateTime',
  valueJson: 'Json',
};

const SCALAR_INDEXED_COLUMNS: readonly AttributeColumnName[] = [
  'valueBoolean',
  'valueText',
  'valueNumber',
  'valueDate',
];

const DEFAULT_SCHEMA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../prisma/schema',
);

const readModelSchemaBody = (modelName: string, schemaDir: string): string | null => {
  const files = readdirSync(schemaDir).filter((file) => file.endsWith('.prisma'));
  const pattern = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`);
  for (const file of files) {
    const content = readFileSync(resolve(schemaDir, file), 'utf8');
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const hasGinIndexOnValueJson = (schemaBody: string): boolean =>
  /@@index\(\s*\[\s*valueJson\s*\]\s*,\s*[^)]*type\s*:\s*Gin\b/.test(schemaBody);

export type AttributeSchemaValidationResult = {
  valid: boolean;
  errors: string[];
};

export type ValidateAttributeModelsOptions = {
  models?: Record<string, AttributeModelConfig>;
  schemaDir?: string;
  schemaBodyByModel?: Record<string, string>;
};

/**
 * Validates via Prisma's generated DMMF field map (`prismaMap`) and Prisma schema indexes that
 * every model registered in `ATTRIBUTE_MODELS` carries the uniform 5 nullable typed value columns
 * (`valueBoolean Boolean?`, `valueText String?`, `valueNumber Float?`, `valueDate DateTime?`,
 * `valueJson Json?`), optional configured locator/resource/disabled/valueType fields, scalar value
 * indexes, and a Postgres `GIN` index on `valueJson`.
 */
export const validateAttributeModels = (
  options: ValidateAttributeModelsOptions = {},
): AttributeSchemaValidationResult => {
  const models = options.models ?? ATTRIBUTE_MODELS;
  const schemaDir = options.schemaDir ?? DEFAULT_SCHEMA_DIR;
  const errors: string[] = [];

  for (const [accessorName, config] of Object.entries(models)) {
    const modelName = toModelName(config.model);
    const model = modelOf(prismaMap, modelName);

    if (!model) {
      errors.push(`${accessorName}: Prisma model '${modelName}' does not exist in prismaMap`);
      continue;
    }

    if (config.locatorField) {
      const locator = fieldOf(prismaMap, modelName, config.locatorField);
      if (
        !locator ||
        (locator.kind !== 'scalar' && locator.kind !== 'enum') ||
        !locator.isRequired
      ) {
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
      if (column.isRequired) {
        errors.push(
          `${modelName}.${columnName}: Attribute typed value column must be optional (nullable) so sibling value columns stay null`,
        );
      }
    }

    const rawIndexes =
      'indexes' in model && Array.isArray(model.indexes)
        ? (model.indexes as readonly { fields: readonly string[] }[])
        : [];
    const indexLists = rawIndexes.map((idx) => idx.fields);

    for (const columnName of SCALAR_INDEXED_COLUMNS) {
      const hasScalarIndex = indexLists.some((fields) => fields.includes(columnName));
      if (!hasScalarIndex) {
        const suggested = config.locatorField
          ? `@@index([${config.locatorField}, ${columnName}])`
          : `@@index([${columnName}])`;
        errors.push(`${modelName}.${columnName}: missing scalar value index (add ${suggested})`);
      }
    }

    const hasJsonIndex = indexLists.some(
      (fields) => fields.length === 1 && fields[0] === 'valueJson',
    );
    const schemaBody =
      options.schemaBodyByModel?.[modelName] ?? readModelSchemaBody(modelName, schemaDir);

    if (!hasJsonIndex || !schemaBody || !hasGinIndexOnValueJson(schemaBody)) {
      errors.push(
        `${modelName}.valueJson: missing Postgres GIN index (add @@index([valueJson], type: Gin))`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
