import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerTagOwnerCategoryHook } from '#/hooks/tagOwnerCategory/hook';
import { registerWebhookHook } from '#/hooks/webhooks/hook';

export const registerHooks = () => {
  registerAuditLogHook();
  registerClearCacheHook();
  registerContactRulesHook();
  registerCronJobSyncHook();
  registerImmutableFieldsHook();
  registerOrderedListHook();
  registerPreventHardDeleteHook();
  registerRulesHook();
  registerTagOwnerCategoryHook();
  registerWebhookHook();
};
