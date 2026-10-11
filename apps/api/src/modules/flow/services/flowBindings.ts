/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/db/generated/client/client';

export const SYSTEM_BINDINGS = ['flowStartedAt', 'userId'] as const;

export const flowBindings = (flow: Flow): Record<string, string> => ({
  ...(flow.bindings as Record<string, string>),
  flowStartedAt: flow.createdAt.toISOString(),
  userId: flow.userId,
});
