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

export const creatorGrantFor = (c: Context<AppEnv>, owner: OwnerRef): CreatorGrant | undefined => {
  const token = c.get('token');
  const userId = actingUser(c)?.id ?? token?.userId ?? null;
  if (!userId) return undefined;
  if (owner.ownerModel === 'Organization') {
    const member = (c.get('organizationUsers') ?? []).find(
      (membership) => membership.organizationId === owner.organizationId,
    );
    if (member) {
      return {
        granteeModel: 'OrganizationUser',
        granteeOrganizationId: member.organizationId,
        granteeUserId: member.userId,
      };
    }
    if (
      token?.ownerModel === 'OrganizationUser' &&
      token.organizationId === owner.organizationId &&
      token.userId
    ) {
      return {
        granteeModel: 'OrganizationUser',
        granteeOrganizationId: owner.organizationId,
        granteeUserId: token.userId,
      };
    }
    return undefined;
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
    return undefined;
  }
  return undefined;
};
