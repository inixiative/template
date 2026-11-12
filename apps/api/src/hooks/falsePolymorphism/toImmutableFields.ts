import {
  type ModelName,
  materializedColumns,
  PolymorphismRegistry,
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
  const materialized = materializedColumns(modelName);
  const refuse = materialized.length
    ? [
        ...new Set([
          ...config.axes.flatMap((axis) => Object.values(axis.fkMap).flat() as string[]),
          ...materialized,
        ]),
      ]
    : [];
  if (typeFields.length)
    polymorphismImmutableFields[modelName] = {
      include: [...typeFields, ...refuse],
      ...(refuse.length ? { refuse } : {}),
    };
}
