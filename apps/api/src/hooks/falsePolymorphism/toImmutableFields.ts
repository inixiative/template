import {
  dualPolymorphismIdColumns,
  type ModelName,
  PolymorphismRegistry,
  sideKeyColumns,
  toModelName,
} from '@template/db';

type ImmutableFieldsOverride = {
  exclude?: string[];
  include?: string[];
  refuse?: string[];
};

export const polymorphismImmutableFields: Partial<Record<ModelName, ImmutableFieldsOverride>> = {};

for (const [model, config] of Object.entries(PolymorphismRegistry)) {
  if (!config) continue;
  const modelName = toModelName(model);
  const typeFields = config.axes.map((axis) => axis.field);
  const dualPolymorphismIds = dualPolymorphismIdColumns(modelName);
  const refuse = dualPolymorphismIds.length
    ? [...new Set([...config.axes.flatMap(sideKeyColumns), ...dualPolymorphismIds])]
    : [];
  if (typeFields.length)
    polymorphismImmutableFields[modelName] = {
      include: [...typeFields, ...refuse],
      ...(refuse.length ? { refuse } : {}),
    };
}
