/**
 * Register all database hooks
 * Import this in both API and worker entry points
 *
 * Note: Polymorphism constraints are automatically injected into the rules
 * and immutable fields registries via transformers at module load time.
 */
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerWebhookHook } from '#/hooks/webhooks/hook';

export const registerHooks = () => {
  registerAuditLogHook();
  registerClearCacheHook();
  registerContactRulesHook();
  registerImmutableFieldsHook();
  registerRulesHook();
  registerWebhookHook();
};
