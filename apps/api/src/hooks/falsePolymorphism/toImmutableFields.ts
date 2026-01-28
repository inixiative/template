import type { ModelName } from '@template/db';
import { FalsePolymorphismRegistry } from './registry';

type ImmutableFieldsOverride = {
  exclude?: string[];
  include?: string[];
};

export const polymorphismImmutableFields: Partial<Record<ModelName, ImmutableFieldsOverride>> = {};

for (const [model, configs] of Object.entries(FalsePolymorphismRegistry)) {
  const typeFields = (configs ?? []).map((c) => c.typeField);
  if (typeFields.length) polymorphismImmutableFields[model as ModelName] = { include: typeFields };
}
