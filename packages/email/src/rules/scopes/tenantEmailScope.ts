/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { NarrowingDefaults } from '@inixiative/json-rules';
import { OWNER_EMAIL_SCOPE } from '@template/email/rules/scopes/ownerEmailScope';
import { SENDER_MEMBER_DEFAULTS } from '@template/email/rules/scopes/senderMemberDefaults';

export const TENANT_EMAIL_SCOPE: NarrowingDefaults['models'] = {
  ...OWNER_EMAIL_SCOPE,
  ...SENDER_MEMBER_DEFAULTS,
};
