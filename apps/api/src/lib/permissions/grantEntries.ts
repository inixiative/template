/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { HydratedRecord, UserWithRelations } from '@template/db';
import type { Token } from '@template/db/generated/client/client';
import type { GrantEntry } from '@template/permissions';

export type GrantedCredential = Pick<Token, 'ownerModel' | 'organizationId' | 'spaceId'>;

const organizationEntry = (organizationId: string): GrantEntry => ({
  resource: 'db:organization',
  record: { id: organizationId },
});

const spaceEntry = (space: { spaceId: string; organizationId: string }): GrantEntry => ({
  resource: 'db:space',
  record: {
    id: space.spaceId,
    organizationId: space.organizationId,
    organization: { id: space.organizationId },
  },
});

export const grantEntries = (
  user: UserWithRelations,
  credential: GrantedCredential | null,
): GrantEntry[] => {
  if (credential?.ownerModel === 'OrganizationUser') {
    const membership = user.organizationUsers.find(
      ({ organizationId }) => organizationId === credential.organizationId,
    );
    if (!membership) return [];
    return [
      organizationEntry(membership.organizationId),
      { resource: 'db:organizationUser', record: membership as HydratedRecord },
    ];
  }
  if (credential?.ownerModel === 'SpaceUser') {
    const membership = user.spaceUsers.find(({ spaceId }) => spaceId === credential.spaceId);
    if (!membership) return [];
    return [
      spaceEntry(membership),
      { resource: 'db:spaceUser', record: membership as HydratedRecord },
    ];
  }
  return [
    { resource: 'db:user', record: user as HydratedRecord },
    ...user.organizationUsers.map(({ organizationId }) => organizationEntry(organizationId)),
    ...user.spaceUsers.map(spaceEntry),
  ];
};
