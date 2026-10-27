/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { join } from 'node:path';
import type { DependencyConfig, ModelName } from '@template/db/test/factoryTypes';
import { getModelRelations } from '@template/db/utils/prismaMapRelations';
import type { ZodObject, ZodTypeAny } from 'zod';

// Looked up by runtime name only, so the ~4,300 generated object schemas stay out
// of every type-checked program that reaches the factories: a computed path is not
// followed by tsc, a static import is.
const zodSchemas: Record<string, ZodObject<Record<string, ZodTypeAny>> | undefined> = require(
  join(import.meta.dir, '../generated/zod/schemas/objects/index.ts'),
);

export const getCreateInputSchema = (
  modelName: ModelName,
): ZodObject<Record<string, ZodTypeAny>> | null =>
  zodSchemas[`${modelName}CreateInputObjectSchema`] ?? null;

export const inferDependencies = (modelName: ModelName): Record<string, DependencyConfig> => {
  const relations = getModelRelations(modelName);
  const zodSchema = getCreateInputSchema(modelName);
  const deps: Record<string, DependencyConfig> = {};

  for (const rel of relations) {
    // Skip relations without a simple FK (composite FKs need manual config)
    if (!rel.foreignKey) continue;

    // Check Zod schema to determine if relation is required
    const isRequired = zodSchema?.shape?.[rel.relationName]?.isOptional?.() === false;

    // Include all relations - required ones auto-create, optional ones use context if provided
    deps[rel.relationName] = {
      modelName: rel.targetModel,
      foreignKey: rel.foreignKey,
      required: isRequired,
    };
  }

  return deps;
};

export const mergeDependencies = (
  modelName: ModelName,
  manualDeps: Record<string, Partial<DependencyConfig> | null> = {},
): Record<string, DependencyConfig> => {
  const inferred = inferDependencies(modelName);
  const merged: Record<string, DependencyConfig> = { ...inferred };

  for (const [key, manualDep] of Object.entries(manualDeps)) {
    if (manualDep === null) {
      delete merged[key];
      continue;
    }

    if (merged[key]) {
      merged[key] = {
        modelName: manualDep.modelName ?? merged[key].modelName,
        foreignKey: manualDep.foreignKey ?? merged[key].foreignKey,
        required: manualDep.required ?? merged[key].required,
      };
    } else {
      if (!manualDep.modelName || !manualDep.foreignKey) {
        throw new Error(
          `Manual dependency ${key} in ${modelName} must specify modelName and foreignKey`,
        );
      }
      merged[key] = {
        modelName: manualDep.modelName,
        foreignKey: manualDep.foreignKey,
        required: manualDep.required ?? false,
      };
    }
  }

  return merged;
};
