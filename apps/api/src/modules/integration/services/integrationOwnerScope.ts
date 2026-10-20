/**
 * @atlas
 * @kind helper
 * @partOf feature:integrations
 * @uses none
 */
import type { IntegrationOwnerScope } from '#/modules/integration/services/findOwnedIntegration';

type Owner = {
  ownerModel: 'User' | 'OrganizationUser' | 'Organization' | 'Space' | 'SpaceUser';
  userId: string | null;
  organizationId: string | null;
  spaceId: string | null;
};

export const integrationOwnerScope = (owner: Owner): IntegrationOwnerScope => {
  if (owner.ownerModel === 'User') return { userId: owner.userId };
  if (owner.ownerModel === 'Space' || owner.ownerModel === 'SpaceUser')
    return { spaceIds: owner.spaceId ? [owner.spaceId] : [] };
  return { organizationIds: owner.organizationId ? [owner.organizationId] : [] };
};
