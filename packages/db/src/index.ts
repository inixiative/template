/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Database client with scope/transaction methods
export { db } from './client';
export type { Db } from './clientTypes';

// Mutation lifecycle hooks
export {
  DbAction,
  HookTiming,
  registerDbHook,
  executeHooks,
  clearHookRegistry,
  type HookFunction,
  type HookOptions,
  type SingleAction,
  type ManyAction,
} from './extensions/mutationLifeCycle';

// Typed model IDs (phantom types for compile-time safety)
export * from './typedModelIds';

// Constraint helpers (CHECK, partial unique indexes)
export { addCheckConstraint, addUniqueWhereNotNull, addGistIndex } from './constraints';

// Registries (schema-level configuration)
export * from './registries';

// Model name utilities
export {
  ModelNames,
  modelNames,
  isModelName,
  toModelName,
  AccessorNames,
  accessorNames,
  isAccessorName,
  toAccessor,
  type ModelName,
  type AccessorName,
  type ModelTypeMap,
} from './utils/modelNames';

// Type-safe delegate helpers (pass-the-delegate pattern)
export {
  query,
  findFirst,
  findUnique,
  findMany,
  create,
  update,
  del,
  count,
  type Args,
  type Result,
  type AnyDelegate,
  type AnyCrudDelegate,
  type RuntimeDelegate,
} from './utils/delegates';

// SQL utilities
export { aliasColumns } from './utils/aliasColumns';

// Runtime schema introspection (Prisma 7)
export { getRuntimeDataModel, getModelRelations } from './utils/runtimeDataModel';
export type { RuntimeDataModel, RuntimeModel, RuntimeField } from './utils/runtimeDataModel';

// Scalar schemas (model schemas without relations)
export * from './generated/zod/scalarSchemas';

// Enum schemas and other zod types (from prisma-zod-generator)
export * from './generated/zod/schemas';

// Prisma namespace for advanced types (Prisma.UserWhereInput, etc.)
export { Prisma } from './generated/client/client';

// Redis client and cache utilities
export {
  createRedisConnection,
  getRedisClient,
  getRedisPub,
  getRedisSub,
  flushRedis,
  redisNamespace,
  type RedisNamespace,
  cache,
  cacheKey,
  clearKey,
  upsertCache,
} from './redis';

// Hydration
export { hydrate, fetchOne } from './hydrate';
export type { HydratedRecord, HydrateInclude, Identifier } from './hydrate';

// For model types: import from @template/db/client or @template/db/models
// For runtime enum values: import from @template/db/enums
