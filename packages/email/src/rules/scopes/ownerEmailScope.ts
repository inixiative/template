/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Condition, NarrowingDefaults } from '@inixiative/json-rules';
import { equalsSuppliedBind } from '@template/db';
import { SHARED_EMAIL_MODEL_DEFAULTS } from '@template/email/rules/scopes/sharedEmailModelDefaults';

const ownersOrganization: Condition = {
  any: [
    equalsSuppliedBind('id', 'organizationId'),
    equalsSuppliedBind('id', 'ownerOrganizationId'),
  ],
};

const ownersSpaces: Condition = {
  any: [
    equalsSuppliedBind('organizationId', 'organizationId'),
    equalsSuppliedBind('id', 'spaceId'),
  ],
};

export const OWNER_EMAIL_SCOPE: NarrowingDefaults['models'] = {
  ...SHARED_EMAIL_MODEL_DEFAULTS,
  Organization: {
    where: ownersOrganization,
    sources: { id: { label: 'name', where: ownersOrganization } },
  },
  Space: { where: ownersSpaces, sources: { id: { label: 'name', where: ownersSpaces } } },
};
