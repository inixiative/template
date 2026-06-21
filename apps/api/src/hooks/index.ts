import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerContactRulesHook } from '#/hooks/contactRules/hook';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { registerEmailVersioningHook } from '#/hooks/emailVersioning/hook';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerOrderedListHook } from '#/hooks/orderedList/hook';
import { registerPreventHardDeleteHook } from '#/hooks/preventHardDelete/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerTagOwnerCategoryHook } from '#/hooks/tagOwnerCategory/hook';
import { registerUserEmailContactHook } from '#/hooks/userEmailContact/hook';
import { registerWebhookSubscriptionUrlHook } from '#/hooks/webhookSubscriptionUrl/hook';
import { registerWebhookHook } from '#/hooks/webhooks/hook';

export const registerHooks = () => {
  registerAuditLogHook();
  registerEmailVersioningHook();
  registerClearCacheHook();
  registerContactRulesHook();
  registerCronJobSyncHook();
  registerImmutableFieldsHook();
  registerOrderedListHook();
  registerPreventHardDeleteHook();
  registerRulesHook();
  registerTagOwnerCategoryHook();
  registerUserEmailContactHook();
  registerWebhookHook();
  registerWebhookSubscriptionUrlHook();
};
