// Database client with scope/transaction methods
export { db } from './client';
export type { Db } from './clientTypes';
// Mutation lifecycle hooks
export {
  clearHookRegistry,
  DbAction,
  type DbInvariant,
  type DbInvariantAction,
  type DbInvariantOptions,
  executeHooks,
  type HookFunction,
  type HookOptions,
  HookTiming,
  type ManyAction,
  registerDbHook,
  registerDbInvariant,
  type SingleAction,
  unregisterDbHook,
  unregisterDbInvariant,
} from './extensions/mutationLifeCycle';
// Automatic soft-delete read/write scoping (app registers the scoper at bootstrap)
export { registerSoftDeleteScoper, type SoftDeleteScoper } from './extensions/softDeleteScopeRegistry';
// Prisma namespace for advanced types (Prisma.UserWhereInput, etc.)
export { Prisma } from './generated/client/client';
// Scalar schemas (model schemas without relations)
export * from './generated/zod/scalarSchemas.gen';
// Enum schemas and other zod types (from prisma-zod-generator)
export * from './generated/zod/schemas';
export type { HydratedRecord, HydrateInclude, Identifier } from './hydrate';
// Hydration
export { fetchOne, hydrate } from './hydrate';
// Supersede lanes (last-claim-wins coordination batons)
export {
  claimLane,
  getJobSupersededBy,
  laneKey,
  reclaimLane,
  releaseLane,
  supersededKey,
  watchLane,
} from './lanes';
// Distributed lock
export {
  createLock,
  type Lock,
  type LockLostReason,
  type LockOptions,
  type LockRedis,
  type LockReleaseResult,
  maxSafeHeartbeatMs,
} from './lock';
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
// biome-ignore lint/complexity/noBannedTypes: Prisma GetPayload generics require {}
export type PrismaBaseArgs = {};
export { OWNER_BINDS, type OwnerKind, ownedBy, ownerBindings } from './registries/ownedBy';
// User with relations type and schema
export type { UserWithRelations } from './types/userWithRelations';
export { UserWithRelationsSchema } from './types/userWithRelations';
export { admitRuleReferences, type RuleReferenceAdmission } from './utils/admitRuleReferences';
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
// Prisma error narrowing
export { isUniqueConstraintError } from './utils/isUniqueConstraintError';
export { isWriteConflictError } from './utils/isWriteConflictError';
// Rule references: the rows a stored rule names, as edges
export { lockedLiveReferences } from './utils/lockedLiveReferences';
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
export { revive } from './utils/revive';
export { RULE_REFERENCEABLE_MODELS } from './utils/ruleReferenceable';
export { RuleReferenceError } from './utils/ruleReferenceError';
export {
  liveRuleReferenceKeys,
  liveRuleReferences,
  type RuleReferenceIssue,
  type RuleReferenceRow,
  ruleReferenceIssues,
} from './utils/ruleReferenceHealth';
export { ruleReferences } from './utils/ruleReferences';
export { type RuleReferenceOwner, syncRuleReferenceEdges } from './utils/syncRuleReferenceEdges';

// Hook shared utilities (ignore fields, redact fields)

// For model types: import from @template/db/client or @template/db/models
// For runtime enum values: import from @template/db/enums
