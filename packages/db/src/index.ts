/**
 * PACKAGE INDEX FILE - Cross-package exports use relative imports.
 * All other files in this package should use absolute #/ imports.
 */

// Database client with scope/transaction methods
export { db, type ExtendedPrismaClient } from './client';

// Mutation lifecycle hooks
export {
  DbAction,
  HookTiming,
  registerDbHook,
  type HookFunction,
  type HookOptions,
} from './extensions/mutationLifeCycle';

// Typed model IDs (phantom types for compile-time safety)
export * from './typedModelIds';

// Constraint helpers (CHECK, partial unique indexes)
export { addCheckConstraint, addUniqueWhereNotNull, addGistIndex } from './constraints';

// Model name utilities
export {
  ModelNames,
  ModelAccessors,
  modelNames,
  isModelName,
  toPrismaAccessor,
  toModelName,
  type ModelName,
} from './utils/modelNames';

// Scalar schemas (model schemas without relations)
export * from './generated/zod/scalarSchemas';

// Re-export Prisma types (will work after prisma generate)
export * from './generated/client/client';
export { Prisma } from './generated/client/client';
