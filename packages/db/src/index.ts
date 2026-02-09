/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Database client with scope/transaction methods
export { db } from './client';
export type { Db } from './clientTypes';
// Constraint helpers (CHECK, partial unique indexes)
export { addCheckConstraint, addGistIndex, addUniqueWhereNotNull } from './constraints';
// Mutation lifecycle hooks
export {
  clearHookRegistry,
  DbAction,
  executeHooks,
  type HookFunction,
  type HookOptions,
  HookTiming,
  type ManyAction,
  registerDbHook,
  type SingleAction,
} from './extensions/mutationLifeCycle';
// Prisma namespace for advanced types (Prisma.UserWhereInput, etc.)
export { Prisma } from './generated/client/client';
// Scalar schemas (model schemas without relations)
export * from './generated/zod/scalarSchemas';
// Enum schemas and other zod types (from prisma-zod-generator)
export * from './generated/zod/schemas';
export type { HydratedRecord, HydrateInclude, Identifier } from './hydrate';
// Hydration
export { fetchOne, hydrate } from './hydrate';
// Redis client and cache utilities
export {
  cache,
  cacheKey,
  clearKey,
  createRedisConnection,
  flushRedis,
  getRedisClient,
  getRedisPub,
  getRedisSub,
  type RedisNamespace,
  redisNamespace,
  upsertCache,
} from './redis';
// Registries (schema-level configuration)
export * from './registries';
// Typed model IDs (phantom types for compile-time safety)
export * from './typedModelIds';
// User with relations type and schema
export type { UserWithRelations } from './types/userWithRelations';
export { UserWithRelationsSchema } from './types/userWithRelations';
// SQL utilities
export { aliasColumns } from './utils/aliasColumns';
// Type-safe delegate helpers (pass-the-delegate pattern)
export {
  type AnyCrudDelegate,
  type AnyDelegate,
  type Args,
  count,
  create,
  del,
  findFirst,
  findMany,
  findUnique,
  query,
  type Result,
  type RuntimeDelegate,
  update,
} from './utils/delegates';
// Model name utilities
export {
  type AccessorName,
  AccessorNames,
  accessorNames,
  isAccessorName,
  isModelName,
  type ModelName,
  ModelNames,
  type ModelTypeMap,
  modelNames,
  toAccessor,
  toModelName,
} from './utils/modelNames';
export type { RuntimeDataModel, RuntimeField, RuntimeModel } from './utils/runtimeDataModel';
// Runtime schema introspection (Prisma 7)
export { getModelRelations, getRuntimeDataModel } from './utils/runtimeDataModel';

// For model types: import from @template/db/client or @template/db/models
// For runtime enum values: import from @template/db/enums
