/**
 * Register all database hooks
 * Import this in both API and worker entry points
 */
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerFalsePolymorphismHook } from '#/hooks/falsePolymorphism/hook';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerWebhookHook } from '#/hooks/webhooks/hook';

export const registerHooks = () => {
  registerClearCacheHook();
  registerFalsePolymorphismHook();
  registerImmutableFieldsHook();
  registerRulesHook();
  registerWebhookHook();
};
