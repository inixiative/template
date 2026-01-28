import { lowerFirst, upperFirst } from 'lodash-es';
import { Prisma, PrismaClient } from '../generated/client/client';

export type ModelName = Prisma.ModelName;

export type ModelTypeMap = { [K in ModelName]: Prisma.TypeMap['model'][K]['payload']['scalars'] };

/** Keys of PrismaClient that are model delegates (have findMany, count, etc.) */
export type ModelDelegate = keyof {
  [K in keyof PrismaClient as PrismaClient[K] extends { findMany: Function } ? K : never]: K;
};

/** Type-safe args for a model operation */
export type ModelArgs<M extends ModelDelegate, Op extends ModelOperation> =
  Prisma.Args<PrismaClient[M], Op>;

/** All Prisma model operations */
export type ModelOperation =
  | 'findMany'
  | 'findFirst'
  | 'findUnique'
  | 'findFirstOrThrow'
  | 'findUniqueOrThrow'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'count'
  | 'aggregate'
  | 'groupBy';

/** Type-safe result for a model operation */
export type ModelResult<M extends ModelDelegate, A, Op extends ModelOperation> =
  Prisma.Result<PrismaClient[M], A, Op>;

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
