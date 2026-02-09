/**
 * Extracts runtimeDataModel and relation metadata from Prisma 7 generated client.
 *
 * Prisma 7 embeds two things in the generated client:
 * 1. runtimeDataModel - minimal field info (name, kind, type, relationName)
 * 2. inlineSchema - the full Prisma schema text
 *
 * The runtimeDataModel lacks FK field mappings, so we parse the inlineSchema
 * to extract @relation(fields: [...], references: [...]) for composite FKs.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { type AccessorName, type ModelName, toAccessor, toModelName } from './modelNames';

const __dirname = dirname(fileURLToPath(import.meta.url));

type FieldKind = 'scalar' | 'object' | 'enum';

export type RuntimeField = {
  name: string;
  kind: FieldKind;
  type: string;
  relationName?: string;
};

export type RuntimeModel = {
  fields: RuntimeField[];
  dbName: string | null;
};

export type RuntimeDataModel = {
  models: Record<string, RuntimeModel>;
  enums: Record<string, unknown>;
  types: Record<string, unknown>;
};

/**
 * Identifier for records - used in two contexts:
 *
 * 1. FK mapping (in RelationInfo.foreignKey): { [targetField]: sourceField }
 *    - Describes how to resolve a relation
 *    - { id: "userId" } → query target WHERE id = record.userId
 *    - { organizationId: "organizationId", id: "spaceId" } → composite FK
 *
 * 2. Query/cache key (resolved values): { [field]: value }
 *    - Actual field names and values for lookup
 *    - { id: "abc-123" } → WHERE id = "abc-123"
 *    - { organizationId: "org1", userId: "user1" } → composite key
 *
 * String shorthand: "userId" or "abc-123" (simple id field)
 */
export type Identifier = string | Record<string, string>;

export type RelationInfo = {
  relationName: string;
  targetModel: ModelName;
  targetAccessor: AccessorName;
  foreignKey: Identifier | null;
};

type RelationFkMapping = {
  fields: string[];
  references: string[];
};

// Caches
let cachedDataModel: RuntimeDataModel | null = null;
let cachedInlineSchema: string | null = null;
let cachedRelationFks: Map<string, Map<string, RelationFkMapping>> | null = null;

const getGeneratedClientContent = (): string => {
  const classPath = join(__dirname, '../generated/client/internal/class.ts');
  return readFileSync(classPath, 'utf-8');
};

export const getRuntimeDataModel = (): RuntimeDataModel => {
  if (cachedDataModel) return cachedDataModel;

  const content = getGeneratedClientContent();

  const match = content.match(/config\.runtimeDataModel\s*=\s*JSON\.parse\("(.+?)"\)/s);
  if (!match) {
    throw new Error('Could not extract runtimeDataModel from generated client');
  }

  const jsonString = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  cachedDataModel = JSON.parse(jsonString) as RuntimeDataModel;

  return cachedDataModel;
};

const getInlineSchema = (): string => {
  if (cachedInlineSchema) return cachedInlineSchema;

  const content = getGeneratedClientContent();

  const match = content.match(/"inlineSchema":\s*"(.+?)(?<!\\)",/s);
  if (!match) {
    throw new Error('Could not extract inlineSchema from generated client');
  }

  cachedInlineSchema = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  return cachedInlineSchema;
};

/**
 * Parse @relation(fields: [...], references: [...]) from schema text.
 * Returns Map<ModelName, Map<RelationFieldName, { fields, references }>>
 */
const parseRelationFks = (): Map<string, Map<string, RelationFkMapping>> => {
  if (cachedRelationFks) return cachedRelationFks;

  const schema = getInlineSchema();
  cachedRelationFks = new Map();

  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let modelMatch;

  while ((modelMatch = modelRegex.exec(schema)) !== null) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2];

    const fieldFks = new Map<string, RelationFkMapping>();

    // Match: fieldName Type @relation(fields: [...], references: [...], ...)
    const relationRegex = /(\w+)\s+\w+\??\s+@relation\s*\(\s*fields:\s*\[([^\]]+)\]\s*,\s*references:\s*\[([^\]]+)\]/g;
    let relMatch;

    while ((relMatch = relationRegex.exec(modelBody)) !== null) {
      const fieldName = relMatch[1];
      const fields = relMatch[2].split(',').map((s) => s.trim());
      const references = relMatch[3].split(',').map((s) => s.trim());
      fieldFks.set(fieldName, { fields, references });
    }

    if (fieldFks.size > 0) {
      cachedRelationFks.set(modelName, fieldFks);
    }
  }

  return cachedRelationFks;
};

/**
 * Build FK identifier for a relation.
 * Maps source fields to target reference fields for proper querying.
 */
const getRelationForeignKey = (modelName: string, relationField: string): Identifier | null => {
  const relationFks = parseRelationFks();
  const modelFks = relationFks.get(modelName);
  if (!modelFks) return null;

  const mapping = modelFks.get(relationField);
  if (!mapping) return null;

  const { fields, references } = mapping;
  if (fields.length !== references.length || fields.length === 0) return null;

  // Simple FK: single field where field name matches reference name
  if (fields.length === 1 && fields[0] === references[0]) {
    return fields[0];
  }

  // Composite or renamed FK: { targetField: sourceField }
  const composite: Record<string, string> = {};
  for (let i = 0; i < fields.length; i++) {
    composite[references[i]] = fields[i];
  }
  return composite;
};

/**
 * Get all relations for a model with their FK fields.
 */
export const getModelRelations = (modelName: ModelName): RelationInfo[] => {
  const dataModel = getRuntimeDataModel();
  const model = dataModel.models[modelName];

  if (!model) {
    throw new Error(`Model ${modelName} not found in runtimeDataModel`);
  }

  return model.fields
    .filter((f) => f.kind === 'object')
    .map((f) => ({
      relationName: f.name,
      targetModel: f.type as ModelName,
      targetAccessor: toAccessor(f.type as ModelName),
      foreignKey: getRelationForeignKey(modelName, f.name),
    }));
};

/** Accessor version - converts accessor to model name internally */
export const getAccessorRelations = (accessor: AccessorName): RelationInfo[] => {
  const modelName = toModelName(accessor);
  if (!modelName) {
    throw new Error(`Unknown accessor: ${accessor}`);
  }
  return getModelRelations(modelName);
};

/** Clear caches - useful for testing */
export const clearRuntimeCaches = (): void => {
  cachedDataModel = null;
  cachedInlineSchema = null;
  cachedRelationFks = null;
};
