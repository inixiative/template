/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import type { DependencyConfig, ModelName } from '@template/db/test/factoryTypes';
import { getModelRelations } from '@template/db/utils/prismaMapRelations';

export const inferDependencies = (modelName: ModelName): Record<string, DependencyConfig> => {
  const relations = getModelRelations(modelName);
  const deps: Record<string, DependencyConfig> = {};

  for (const rel of relations) {
    // Skip relations without a simple FK (composite FKs need manual config)
    if (!rel.foreignKey) continue;

    // Include all relations - required ones auto-create, optional ones use context if provided
    deps[rel.relationName] = {
      modelName: rel.targetModel,
      foreignKey: rel.foreignKey,
      required: rel.isRequired,
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
