import { lowerFirst, upperFirst } from 'lodash-es';
import { Prisma } from '../generated/client/client';

export type ModelName = Prisma.ModelName;

export const ModelNames = Prisma.ModelName;

export const modelNames = Object.values(Prisma.ModelName);

export const isModelName = (value: string): value is ModelName => {
  return modelNames.includes(value as ModelName);
};

export const toPrismaAccessor = (modelName: ModelName): string => {
  return lowerFirst(modelName);
};

export const toModelName = (accessor: string): ModelName | undefined => {
  const capitalized = upperFirst(accessor);
  return isModelName(capitalized) ? capitalized : undefined;
};

type ModelAccessor = { [K in ModelName as Uncapitalize<K>]: Uncapitalize<K> };

export const ModelAccessors = Object.fromEntries(
  modelNames.map((name) => {
    const accessor = toPrismaAccessor(name);
    return [accessor, accessor];
  }),
) as ModelAccessor;
