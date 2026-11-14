/**
 * @atlas
 * @kind helper
 * @partOf feature:files
 * @uses primitive:requestContext
 */
import type { Context } from 'hono';
import type { OwnerRef } from '#/modules/artifact/lib/artifactOwner';
import type { CreatorGrant } from '#/modules/artifact/services/artifactPlacements';
import type { AppEnv } from '#/types/appEnv';

export const creatorGrantFor = (c: Context<AppEnv>, owner: OwnerRef): CreatorGrant | undefined => {
  const user = c.get('user');
  if (!user) return undefined;
  if (owner.ownerModel === 'Organization') {
    const member = (c.get('organizationUsers') ?? []).find(
      (membership) => membership.organizationId === owner.organizationId,
    );
    return member
      ? {
          granteeModel: 'OrganizationUser',
          granteeOrganizationId: member.organizationId,
          granteeUserId: member.userId,
        }
      : undefined;
  }
  if (owner.ownerModel === 'Space') {
    const member = (c.get('spaceUsers') ?? []).find(
      (membership) => membership.spaceId === owner.spaceId,
    );
    return member
      ? {
          granteeModel: 'SpaceUser',
          granteeOrganizationId: member.organizationId,
          granteeSpaceId: member.spaceId,
          granteeUserId: member.userId,
        }
      : undefined;
  }
  return undefined;
};
