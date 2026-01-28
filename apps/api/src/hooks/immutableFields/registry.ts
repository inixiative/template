import { getModelRelations, type ModelName } from '@template/db';
import { FalsePolymorphismRegistry } from '#/hooks/falsePolymorphism/registry';

type ImmutableFieldsOverride = {
  exclude?: string[];
  include?: string[];
};

// --- Polymorphism → Immutable Fields Transformer ---

const polymorphismOverrides: Partial<Record<ModelName, ImmutableFieldsOverride>> = {};
for (const [model, configs] of Object.entries(FalsePolymorphismRegistry)) {
  const typeFields = (configs ?? []).map((c) => c.typeField);
  if (typeFields.length) polymorphismOverrides[model as ModelName] = { include: typeFields };
}

// --- Immutable Fields Registry ---

export const ImmutableFieldsOverrides: Partial<Record<ModelName, ImmutableFieldsOverride>> = {
  ...polymorphismOverrides,
  // Add additional overrides here:
  // User: { exclude: ['updatableFkField'] },
};

const inferForeignKeyFields = (modelName: ModelName): string[] => {
  const relations = getModelRelations(modelName);
  return relations.map((r) => r.foreignKey).filter((fk): fk is string => fk !== null);
};

const immutableFieldsCache = new Map<ModelName, readonly string[]>();

export const clearImmutableFieldsCache = (model?: ModelName): void => {
  if (model) immutableFieldsCache.delete(model);
  else immutableFieldsCache.clear();
};

export const setImmutableFieldsCache = (model: ModelName, fields: readonly string[]): void => {
  immutableFieldsCache.set(model, fields);
};

export const getImmutableFields = (model: ModelName): readonly string[] => {
  if (immutableFieldsCache.has(model)) return immutableFieldsCache.get(model)!;

  const inferred = inferForeignKeyFields(model);
  const overrides = ImmutableFieldsOverrides[model];

  let fields = inferred;
  if (overrides?.exclude?.length) fields = fields.filter((f) => !overrides.exclude!.includes(f));
  if (overrides?.include?.length) fields = [...fields, ...overrides.include];

  const result = [...new Set(fields)];
  immutableFieldsCache.set(model, result);
  return result;
};
