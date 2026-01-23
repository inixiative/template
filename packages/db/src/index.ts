// Client
export { createPrismaClient, db, type ExtendedPrismaClient } from './client';

// Mutation lifecycle hooks
export {
  DbAction,
  HookTiming,
  registerDbHook,
  type HookFunction,
  type HookOptions,
} from './extensions/mutationLifeCycle';

// Cache invalidation
export { fetchCacheKeys, cacheReference } from './extensions/cacheReference';
export { registerClearCacheHook } from './extensions/clearCacheHook';

// Webhook hooks
export {
  registerWebhookHook,
  WebhookAction,
  type WebhookPayload,
  type WebhookDeliveryFn,
} from './extensions/webhookHook';

// Typed model IDs (phantom types for compile-time safety)
export * from './typedModelIds';

// Re-export Prisma types (will work after prisma generate)
export * from './generated/client/client';
