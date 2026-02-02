import { getModelRelations, type ModelName } from '@template/db';
import { polymorphismImmutableFields } from '#/hooks/falsePolymorphism/toImmutableFields';

// Fields that should never be modified on any model
const GLOBAL_IMMUTABLE_FIELDS = ['id', 'createdAt'] as const;

type ImmutableFieldsOverride = {
  exclude?: string[];
  include?: string[];
};

export const ImmutableFieldsOverrides: Partial<Record<ModelName, ImmutableFieldsOverride>> = {
  ...polymorphismImmutableFields,
  // Add additional overrides here:
  // User: { exclude: ['updatableFkField'] },
};

const inferForeignKeyFields = (modelName: ModelName): string[] => {
  const relations = getModelRelations(modelName);
  const fields: string[] = [];

  for (const r of relations) {
    if (!r.foreignKey) continue;
    if (typeof r.foreignKey === 'string') {
      // Simple FK: the string is the field name
      fields.push(r.foreignKey);
    } else {
      // Object FK: values are the source field names (e.g., { id: 'userId' } → 'userId')
      fields.push(...Object.values(r.foreignKey));
    }
  }

  return fields;
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

  let fields = [...GLOBAL_IMMUTABLE_FIELDS, ...inferred];
  if (overrides?.exclude?.length) fields = fields.filter((f) => !overrides.exclude!.includes(f));
  if (overrides?.include?.length) fields = [...fields, ...overrides.include];

  const result = [...new Set(fields)];
  immutableFieldsCache.set(model, result);
  return result;
};
