/**
 * @atlas
 * @partOf infrastructure:prisma
 * @uses none
 */

import { discriminatorRequiresValue } from '@template/db/registries/discriminatorDefaults';
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/test/factoryTypes';

const axesOf = (modelName: ModelName) => getPolymorphismConfig(modelName)?.axes ?? [];

export const assertNoDiscriminatorDefaults = (
  modelName: ModelName,
  defaults: Record<string, unknown>,
) => {
  const defaulted = axesOf(modelName)
    .map((axis) => axis.field)
    .filter((field) => field in defaults);
  if (defaulted.length)
    throw new Error(
      `${modelName} factory defaults its discriminator ${defaulted.join(', ')}; callers choose it`,
    );
};

export const assertDiscriminatorsChosen = (
  modelName: ModelName,
  fields: Record<string, unknown>,
) => {
  for (const axis of axesOf(modelName))
    if (fields[axis.field] == null && discriminatorRequiresValue(modelName, axis.field))
      throw new Error(`create${modelName}: ${axis.field} is required — pass it`);
};

export const assertSelectedForeignKeys = (
  modelName: ModelName,
  fields: Record<string, unknown>,
) => {
  for (const axis of axesOf(modelName)) {
    const value = fields[axis.field];
    if (value == null) continue;
    const missing = ((axis.fkMap as Partial<Record<string, string[]>>)[String(value)] ?? []).filter(
      (foreignKey) => fields[foreignKey] == null,
    );
    if (missing.length)
      throw new Error(
        `${modelName} ${axis.field}=${String(value)} needs ${missing.join(', ')} — pass the ${String(value)}`,
      );
  }
};
