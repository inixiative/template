import * as zodSchemas from '@template/db/generated/zod/schemas/objects';
import { getModelRelations } from '@template/db/utils/runtimeDataModel';
import type { ZodObject, ZodTypeAny } from 'zod';
import type { DependencyConfig, ModelName } from './factoryTypes';

const getCreateInputSchema = (modelName: ModelName): ZodObject<Record<string, ZodTypeAny>> | null => {
  const schemaKey = `${modelName}CreateInputObjectSchema` as keyof typeof zodSchemas;
  return (zodSchemas[schemaKey] as ZodObject<Record<string, ZodTypeAny>>) ?? null;
};

/**
 * Infer dependencies from Prisma runtimeDataModel.
 *
 * Uses:
 * - `runtimeDataModel` for relation metadata (kind: "object" fields)
 * - Zod CreateInput schema for optionality detection
 *
 * Only creates required dependencies (optional relations are skipped).
 *
 * Edge cases requiring manual config:
 * - Composite foreign keys (e.g., Token -> OrganizationUser uses [orgId, userId])
 */
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
      modelName: rel.targetModel as ModelName,
      foreignKey: rel.foreignKey,
      required: isRequired,
    };
  }

  return deps;
};

/**
 * Merge inferred dependencies with manual overrides.
 *
 * @param modelName - The model to get dependencies for
 * @param manualDeps - Manual overrides:
 *   - `null` removes an inferred dependency
 *   - Partial config merges with inferred
 *   - Full config adds new dependency
 */
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
        throw new Error(`Manual dependency ${key} in ${modelName} must specify modelName and foreignKey`);
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
