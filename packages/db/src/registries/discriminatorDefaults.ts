/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { prismaMap } from '@template/db/generated/prismaMap';
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

type MappedField = { isRequired: boolean; default?: { kind: string; value?: unknown } };

const fieldOf = (modelName: ModelName, field: string) =>
  (prismaMap.models[modelName]?.fields as Record<string, MappedField> | undefined)?.[field];

export const discriminatorDefault = (modelName: ModelName, field: string): unknown => {
  const fieldDefault = fieldOf(modelName, field)?.default;
  return fieldDefault?.kind === 'literal' ? fieldDefault.value : undefined;
};

export const discriminatorRequiresValue = (modelName: ModelName, field: string) =>
  fieldOf(modelName, field)?.isRequired === true &&
  discriminatorDefault(modelName, field) === undefined;

export const withDiscriminatorDefaults = <T extends Record<string, unknown>>(
  modelName: ModelName,
  fields: T,
): T & Record<string, unknown> => {
  const filled: Record<string, unknown> = { ...fields };
  for (const axis of getPolymorphismConfig(modelName)?.axes ?? [])
    if (filled[axis.field] === undefined)
      filled[axis.field] = discriminatorDefault(modelName, axis.field);
  return filled as T & Record<string, unknown>;
};
