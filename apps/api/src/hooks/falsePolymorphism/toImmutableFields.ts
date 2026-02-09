import { type ModelName, PolymorphismRegistry } from '@template/db';

type ImmutableFieldsOverride = {
  exclude?: string[];
  include?: string[];
};

export const polymorphismImmutableFields: Partial<Record<ModelName, ImmutableFieldsOverride>> = {};

for (const [model, config] of Object.entries(PolymorphismRegistry)) {
  if (!config) continue;
  const typeFields = config.axes.map((axis) => axis.field);
  if (typeFields.length) polymorphismImmutableFields[model as ModelName] = { include: typeFields };
}
