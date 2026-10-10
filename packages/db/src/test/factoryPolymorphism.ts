/**
 * @atlas
 * @partOf infrastructure:prisma
 * @uses none
 */

import {
  discriminatorDefault,
  discriminatorRequiresValue,
} from '@template/db/registries/discriminatorDefaults';
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
    const foreignKeysByValue = axis.fkMap as Partial<Record<string, string[]>>;
    const selected = foreignKeysByValue[String(value)] ?? [];
    const missing = selected.filter((foreignKey) => fields[foreignKey] == null);
    if (missing.length)
      throw new Error(
        `${modelName} ${axis.field}=${String(value)} needs ${missing.join(', ')} — pass the ${String(value)}`,
      );
    const stray = [...new Set(Object.values(foreignKeysByValue).flat())].filter(
      (foreignKey) => foreignKey && !selected.includes(foreignKey) && fields[foreignKey] != null,
    );
    if (stray.length)
      throw new Error(
        `${modelName} ${axis.field}=${String(value)} cannot have ${stray.join(', ')}`,
      );
  }
};

export const assertParentFollowsAxes = (
  modelName: ModelName,
  fields: Record<string, unknown>,
  parentModel: ModelName,
) => {
  for (const axis of axesOf(modelName)) {
    if (!axesOf(parentModel).some((parentAxis) => parentAxis.field === axis.field)) continue;
    if (fields[axis.field] === discriminatorDefault(parentModel, axis.field)) continue;
    throw new Error(
      `${modelName} ${axis.field}=${String(fields[axis.field])} needs a ${parentModel} with the same ${axis.field} — create it and pass it in context`,
    );
  }
};
