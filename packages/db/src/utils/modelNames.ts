import { lowerFirst, upperFirst } from 'lodash-es';
import { Prisma, PrismaClient } from '../generated/client/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ModelName = Prisma.ModelName;

export type AccessorName = Uncapitalize<ModelName>;

export type ModelTypeMap = { [K in ModelName]: Prisma.TypeMap['model'][K]['payload']['scalars'] };

/** Keys of PrismaClient that are model delegates (have findMany, count, etc.) */
export type ModelDelegate = keyof {
  [K in keyof PrismaClient as PrismaClient[K] extends { findMany: Function } ? K : never]: K;
};

/** Type-safe args for a model operation */
export type ModelArgs<M extends ModelDelegate, Op extends ModelOperation> = Prisma.Args<PrismaClient[M], Op>;

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
export type ModelResult<M extends ModelDelegate, A, Op extends ModelOperation> = Prisma.Result<PrismaClient[M], A, Op>;

// ─────────────────────────────────────────────────────────────────────────────
// PascalCase (ModelName) utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Enum-like object: { User: 'User', Organization: 'Organization', ... } */
export const ModelNames = Prisma.ModelName;

/** Array of all model names: ['User', 'Organization', ...] */
export const modelNames = Object.values(Prisma.ModelName);

/** Type guard for ModelName */
export const isModelName = (value: string): value is ModelName => modelNames.includes(value as ModelName);

/** Convert accessor to ModelName: 'user' → 'User' */
export const toModelName = (accessor: string): ModelName | undefined => {
  const capitalized = upperFirst(accessor);
  return isModelName(capitalized) ? capitalized : undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// camelCase (AccessorName) utilities
// ─────────────────────────────────────────────────────────────────────────────

type AccessorTypeMap = { [K in ModelName as Uncapitalize<K>]: Uncapitalize<K> };

/** Enum-like object: { user: 'user', organization: 'organization', ... } */
export const AccessorNames: AccessorTypeMap = Object.fromEntries(
  modelNames.map((name) => [lowerFirst(name), lowerFirst(name)]),
) as AccessorTypeMap;

/** Array of all accessor names: ['user', 'organization', ...] */
export const accessorNames = Object.values(AccessorNames);

/** Type guard for AccessorName */
export const isAccessorName = (value: string): value is AccessorName => accessorNames.includes(value as AccessorName);

/** Convert ModelName to accessor: 'User' → 'user' */
export const toAccessor = (model: ModelName): AccessorName => lowerFirst(model) as AccessorName;

// ─────────────────────────────────────────────────────────────────────────────
// Delegate utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Get the Prisma delegate for a model: toDelegate(db, 'User') → db.user */
export const toDelegate = <T extends { [K in ModelDelegate]: PrismaClient[K] }>(
  client: T,
  model: ModelName,
): PrismaClient[ModelDelegate] => client[toAccessor(model) as ModelDelegate];

