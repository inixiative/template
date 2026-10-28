// Database client with scope/transaction methods
export { db } from './client';
export type { Db, FinallyFn, FindForUpdateOptions } from './clientTypes';
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
  snapshotHookRegistry,
  unregisterDbHook,
} from './extensions/hookRegistry';
// Prisma namespace for advanced types (Prisma.UserWhereInput, etc.)
export { Prisma } from './generated/client/client';
// Enum schemas (from prisma-zod-generator); object/input schemas live at @template/db/zod/*
export * from './generated/zod/enums.gen';
// Scalar schemas (model schemas without relations)
export * from './generated/zod/scalarSchemas.gen';
export type { HydratedRecord, HydrateInclude, Identifier } from './hydrate';
// Hydration
export { fetchOne, hydrate } from './hydrate';
// Supersede lanes (last-claim-wins coordination batons)
export {
  claimLane,
  getJobSupersededBy,
  holdLaneWhileParked,
  laneKey,
  reclaimLane,
  releaseLane,
  supersededKey,
  tombstoneJob,
  watchLane,
} from './lanes';
// Distributed lock
export {
  type AcquireOptions,
  createLock,
  FindForUpdateLockTimeoutError,
  type Lock,
  LockLostError,
  type LockLostReason,
  type LockOptions,
  type LockRedis,
  type LockReleaseResult,
  maxSafeHeartbeatMs,
} from './lock';
// Redis client and cache utilities
export {
  type CacheCheck,
  COMMAND_TIMEOUT_MS,
  cache,
  cacheKey,
  checkCache,
  clearKey,
  createRedisConnection,
  flushRedis,
  getRedisClient,
  getRedisPub,
  getRedisSub,
  getRollingCache,
  listRollingCaches,
  MAX_ROLLING_CACHE_TARGETS,
  MIN_ROLLING_CACHE_INTERVAL_SECONDS,
  makeRollingCache,
  type RedisEval,
  type RedisNamespace,
  type RegisteredRollingCache,
  ROLLING_CACHE_LEAF_ATTEMPTS,
  ROLLING_CACHE_TICK_SECONDS,
  type RollingCache,
  type RollingCacheComputeContext,
  type RollingCacheConfig,
  type RollingCacheFindManyArgs,
  type RollingCacheResultParams,
  type RollingCacheResults,
  type RollingCacheTarget,
  type RollingCacheTargets,
  type RollingCacheValue,
  type RollingCacheWrite,
  redisNamespace,
  singleFlightLock,
  unregisterRollingCache,
  upsertCache,
} from './redis';
// Registries (schema-level configuration)
export * from './registries';
// Typed model IDs (phantom types for compile-time safety)
export * from './typedModelIds';
// biome-ignore lint/complexity/noBannedTypes: Prisma GetPayload generics require {}
export type PrismaBaseArgs = {};
export {
  type EnumField,
  isScalarField,
  type ModelField,
  type RelationField,
  type ScalarField,
} from '@inixiative/prisma-map';
export { equalsSuppliedBind } from './registries/equalsSuppliedBind';
export {
  isOwnerKind,
  POLYMORPHIC_BINDS,
  type PolymorphicKind,
  polymorphicBindings,
  polymorphicIs,
  polymorphicKeyColumn,
  polymorphicTarget,
} from './registries/polymorphicIs';
export { polymorphicSchema } from './registries/polymorphicSchema';
export type {
  PolymorphicAxisField,
  PolymorphicAxisValue,
  PolymorphicFkColumn,
  PolymorphicModel,
  PolymorphicSchema,
  PolymorphicSchemaOptions,
  PolymorphicTarget,
} from './registries/polymorphicSchemaTypes';
// User with relations type and schema
export type { UserWithRelations } from './types/userWithRelations';
export { UserWithRelationsSchema } from './types/userWithRelations';
// SQL utilities
export { aliasColumns } from './utils/aliasColumns';
export { carryDelegatedKeys } from './utils/carryDelegatedKeys';
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
export { hasDeletedAt, lookupField, modelFields, SOFT_DELETE_MODELS } from './utils/fieldMetadata';
// Prisma error narrowing
export { isUniqueConstraintError } from './utils/isUniqueConstraintError';
export { isWriteConflictError } from './utils/isWriteConflictError';
// Rule references: the rows a stored rule names, as edges
export { lockedTargetStates, type TargetState } from './utils/lockedTargetStates';
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
// Relation introspection, derived from the generated prismaMap (single source of truth)
export { getModelRelations } from './utils/prismaMapRelations';
export { isCleared, isPrismaNull } from './utils/prismaNull';
export { revive } from './utils/revive';
export { RULE_REFERENCEABLE_MODELS } from './utils/ruleReferenceable';
export { RuleReferenceError } from './utils/ruleReferenceError';
export {
  type RuleReferenceRow,
  type RuleReferenceTarget,
  ruleReferenceTargets,
} from './utils/ruleReferenceHealth';
export {
  type DynamicRuleReference,
  dynamicRuleReferences,
  ruleReferences,
} from './utils/ruleReferences';
export {
  compiledSourceWhere,
  type SourceQueryScope,
  sourceQueryValues,
} from './utils/sourceQueryValues';
export { sourceQueryWhere } from './utils/sourceQueryWhere';
export { type RuleReferenceSource, syncRuleReferenceEdges } from './utils/syncRuleReferenceEdges';
export { type NodeContext, type NodeScope, walkWhere } from './utils/whereWalker';
export { assertRuleReferencesExist } from './validations/assertRuleReferencesExist';
export {
  type DeadRuleReference,
  deadRuleReferences,
  type ReferenceScope,
} from './validations/deadRuleReferences';
export {
  type RuleValidation,
  type ValidateRuleForLensOptions,
  validateRuleForLens,
} from './validations/validateRuleForLens';

// Hook shared utilities (ignore fields, redact fields)

// For model types: import from @template/db/client or @template/db/models
// For runtime enum values: import from @template/db/enums
