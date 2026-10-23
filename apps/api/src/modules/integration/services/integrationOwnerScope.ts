/**
 * @atlas
 * @kind helper
 * @partOf feature:integrations
 * @uses infrastructure:prisma
 */
import type { UserId } from '@template/db';
import type { IntegrationOwnerScope } from '#/modules/integration/services/findOwnedIntegration';
import { findUserWithRelations } from '#/modules/user/services/find';

type Owner = {
  ownerModel: 'User' | 'OrganizationUser' | 'Organization' | 'Space' | 'SpaceUser';
  userId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
};

export const integrationOwnerScope = async (owner: Owner): Promise<IntegrationOwnerScope> => {
  if (owner.ownerModel === 'User') {
    const user = owner.userId ? await findUserWithRelations(owner.userId as UserId) : null;
    return {
      userId: user?.id ?? null,
      organizationIds: user?.organizationUsers.map((membership) => membership.organizationId) ?? [],
      spaceIds: user?.spaceUsers.map((membership) => membership.spaceId) ?? [],
    };
  }
  if (owner.ownerModel === 'Space' || owner.ownerModel === 'SpaceUser')
    return { spaceIds: owner.spaceId ? [owner.spaceId] : [] };
  return { organizationIds: owner.organizationId ? [owner.organizationId] : [] };
};
