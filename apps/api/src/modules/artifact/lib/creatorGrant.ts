/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses primitive:requestContext
 */
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import type { OwnerRef } from '#/modules/artifact/lib/artifactOwner';
import type { CreatorGrant } from '#/modules/artifact/services/artifactPlacements';
import type { AppEnv } from '#/types/appEnv';

const orgMemberGrant = (
  c: Context<AppEnv>,
  organizationId: string | null | undefined,
): CreatorGrant | undefined => {
  if (!organizationId) return undefined;
  const member = (c.get('organizationUsers') ?? []).find(
    (membership) => membership.organizationId === organizationId,
  );
  if (member) {
    return {
      granteeModel: 'OrganizationUser',
      granteeOrganizationId: member.organizationId,
      granteeUserId: member.userId,
    };
  }
  const token = c.get('token');
  if (
    token?.ownerModel === 'OrganizationUser' &&
    token.organizationId === organizationId &&
    token.userId
  ) {
    return {
      granteeModel: 'OrganizationUser',
      granteeOrganizationId: organizationId,
      granteeUserId: token.userId,
    };
  }
  return undefined;
};

export const creatorGrantFor = (c: Context<AppEnv>, owner: OwnerRef): CreatorGrant | undefined => {
  const token = c.get('token');
  const userId = actingUser(c)?.id ?? token?.userId ?? null;
  if (!userId) return undefined;
  if (owner.ownerModel === 'Organization') {
    return orgMemberGrant(c, owner.organizationId);
  }
  if (owner.ownerModel === 'Space') {
    const member = (c.get('spaceUsers') ?? []).find(
      (membership) => membership.spaceId === owner.spaceId,
    );
    if (member) {
      return {
        granteeModel: 'SpaceUser',
        granteeOrganizationId: member.organizationId,
        granteeSpaceId: member.spaceId,
        granteeUserId: member.userId,
      };
    }
    if (
      token?.ownerModel === 'SpaceUser' &&
      token.spaceId === owner.spaceId &&
      token.organizationId &&
      token.userId
    ) {
      return {
        granteeModel: 'SpaceUser',
        granteeOrganizationId: token.organizationId,
        granteeSpaceId: owner.spaceId,
        granteeUserId: token.userId,
      };
    }
    return orgMemberGrant(c, owner.organizationId);
  }
  return undefined;
};
