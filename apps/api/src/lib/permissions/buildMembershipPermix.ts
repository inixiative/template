/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId } from '@template/db';
import type { OrganizationUser, SpaceUser } from '@template/db/generated/client/client';
import {
  createPermissions,
  getMembershipPermissions,
  getOrgPermissions,
  getSpacePermissions,
  type MembershipResource,
  type Permix,
  UserAction,
} from '@template/permissions';
import { setupEntitlements } from '#/lib/permissions/setupEntitlements';
import { validateRole } from '#/lib/permissions/validateRole';

type Membership = OrganizationUser | SpaceUser;

const isSpaceUser = (membership: Membership): membership is SpaceUser => 'spaceId' in membership;

export const buildMembershipPermix = async (
  resource: MembershipResource,
  membership: Membership | null,
): Promise<Permix> => {
  const permix = createPermissions();
  if (!membership) return permix;
  const role = validateRole(membership.role);
  const organizationId = membership.organizationId as OrganizationId;

  await permix.setup({
    resource: 'db:user',
    id: membership.userId,
    actions: { [UserAction.identify]: true },
  });
  if (isSpaceUser(membership)) {
    const spaceId = membership.spaceId as SpaceId;
    await permix.setup(getSpacePermissions(role, spaceId));
    await setupEntitlements(permix, membership.entitlements, {
      ownerKey: `db:space:${spaceId}`,
      selfIds: {
        space: spaceId,
        organization: organizationId,
        user: membership.userId,
        spaceUser: membership.id,
      },
    });
  } else {
    await permix.setup(getOrgPermissions(role, organizationId));
    await setupEntitlements(permix, membership.entitlements, {
      ownerKey: `db:organization:${organizationId}`,
      selfIds: {
        organization: organizationId,
        user: membership.userId,
        organizationUser: membership.id,
      },
    });
  }
  await permix.setup(getMembershipPermissions(resource, 'owner', membership.id));
  return permix;
};
