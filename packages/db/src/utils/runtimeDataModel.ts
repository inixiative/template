/**
 * Extracts runtimeDataModel from Prisma 7 generated client.
 *
 * Prisma 7 embeds relation metadata in the generated client but doesn't export it.
 * This module parses it from the generated file to enable runtime introspection.
 *
 * Structure:
 * - models[ModelName].fields[] contains all fields
 * - kind: "scalar" | "object" | "enum"
 * - For relations (kind: "object"): type is the related model name
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

let cachedDataModel: RuntimeDataModel | null = null;

export const getRuntimeDataModel = (): RuntimeDataModel => {
  if (cachedDataModel) return cachedDataModel;

  const classPath = join(__dirname, '../generated/client/internal/class.ts');
  const content = readFileSync(classPath, 'utf-8');

  // Extract JSON from: config.runtimeDataModel = JSON.parse("...")
  const match = content.match(/config\.runtimeDataModel\s*=\s*JSON\.parse\("(.+?)"\)/s);
  if (!match) {
    throw new Error('Could not extract runtimeDataModel from generated client');
  }

  // Unescape the JSON string (it's double-escaped in the source)
  const jsonString = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  cachedDataModel = JSON.parse(jsonString) as RuntimeDataModel;

  return cachedDataModel;
};

/**
 * Get all relations for a model with their inferred FK fields.
 *
 * For relation `user` of type `User`, looks for scalar field `userId`.
 */
export const getModelRelations = (
  modelName: string,
): Array<{ relationName: string; targetModel: string; foreignKey: string | null }> => {
  const dataModel = getRuntimeDataModel();
  const model = dataModel.models[modelName];

  if (!model) {
    throw new Error(`Model ${modelName} not found in runtimeDataModel`);
  }

  const scalarFields = new Set(model.fields.filter((f) => f.kind === 'scalar').map((f) => f.name));

  return model.fields
    .filter((f) => f.kind === 'object')
    .map((f) => {
      // Try to find FK: relationName + "Id" (e.g., user -> userId)
      const possibleFk = `${f.name}Id`;
      const foreignKey = scalarFields.has(possibleFk) ? possibleFk : null;

      return {
        relationName: f.name,
        targetModel: f.type,
        foreignKey,
      };
    });
};
