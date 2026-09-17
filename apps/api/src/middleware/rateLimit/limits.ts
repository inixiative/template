/**
 * @atlas
 * @kind config
 * @partOf infrastructure:redis
 * @uses none
 */
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export type RateLimitTier = 'user' | 'space' | 'organization' | 'auth';

const DEFAULT_MAX: Record<RateLimitTier, number> = {
  user: 10,
  space: 30,
  organization: 60,
  auth: 60,
};

// Seam for subscriptions / feature flags (INFRA-027): limits are entitlements, never columns on Token, Organization or Space.
export const rateLimitMax = (tier: RateLimitTier, _c: Context<AppEnv>): number => DEFAULT_MAX[tier];
