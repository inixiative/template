/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { NarrowingDefaults } from '@inixiative/json-rules';
import { PLATFORM_EMAIL_SCOPE } from '@template/email/rules/scopes/platformEmailScope';
import { SENDER_MEMBER_DEFAULTS } from '@template/email/rules/scopes/senderMemberDefaults';

export const PLATFORM_OWNER_EMAIL_SCOPE: NarrowingDefaults['models'] = {
  ...PLATFORM_EMAIL_SCOPE,
  ...SENDER_MEMBER_DEFAULTS,
};
