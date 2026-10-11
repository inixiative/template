/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/db/generated/client/client';

export const FLOW_BINDINGS = ['flowStartedAt', 'userId'] as const;

export const flowBindings = (flow: Flow): Record<string, string> => ({
  ...(flow.params as Record<string, string>),
  flowStartedAt: flow.createdAt.toISOString(),
  userId: flow.userId,
});
