/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { NarrowingDefaults } from '@inixiative/json-rules';
import { SHARED_EMAIL_MODEL_DEFAULTS } from '@template/email/rules/scopes/sharedEmailModelDefaults';

export const PLATFORM_EMAIL_SCOPE: NarrowingDefaults['models'] = {
  ...SHARED_EMAIL_MODEL_DEFAULTS,
  Organization: { sources: { id: { label: 'name' } } },
  Space: { sources: { id: { label: 'name' } } },
};
