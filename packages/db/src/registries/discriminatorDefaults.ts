/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { fieldOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { polymorphismConfigForModel } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

const defaultOf = (modelName: ModelName, field: string) => {
  const entry = fieldOf(prismaMap, modelName, field);
  return entry && 'default' in entry ? entry.default : undefined;
};

export const discriminatorDefault = (modelName: ModelName, field: string): unknown => {
  const fieldDefault = defaultOf(modelName, field);
  return fieldDefault?.kind === 'literal' ? fieldDefault.value : undefined;
};

export const discriminatorRequiresValue = (modelName: ModelName, field: string) =>
  fieldOf(prismaMap, modelName, field)?.isRequired === true &&
  discriminatorDefault(modelName, field) === undefined;

export const withDiscriminatorDefaults = <T extends Record<string, unknown>>(
  modelName: ModelName,
  fields: T,
): T & Record<string, unknown> => {
  const filled: Record<string, unknown> = { ...fields };
  for (const axis of polymorphismConfigForModel(modelName)?.axes ?? [])
    if (filled[axis.field] === undefined)
      filled[axis.field] = discriminatorDefault(modelName, axis.field);
  return filled as T & Record<string, unknown>;
};
