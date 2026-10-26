/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { NarrowingDefaults } from '@inixiative/json-rules';
import { equalsSuppliedBind } from '@template/db';

const sendersOrganization = equalsSuppliedBind('organizationId', 'senderOrganizationId');

export const SENDER_MEMBER_DEFAULTS: NarrowingDefaults['models'] = {
  OrganizationUser: { where: sendersOrganization },
  SpaceUser: { where: sendersOrganization },
};
