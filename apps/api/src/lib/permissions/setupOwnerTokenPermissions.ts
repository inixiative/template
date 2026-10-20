/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId } from '@template/db';
import {
  type Entitlements,
  getOrgPermissions,
  getSpacePermissions,
  type Permix,
} from '@template/permissions';
import type { TokenWithRelations } from '#/lib/context/types';
import { validateRole } from '#/lib/permissions/validateRole';

export const setupOwnerTokenPermissions = async (permix: Permix, token: TokenWithRelations) => {
  const role = validateRole(token.role);
  const entitlements = token.entitlements as Entitlements;
  if (token.ownerModel === 'Organization' && token.organizationId)
    await permix.setup(
      getOrgPermissions(
        role,
        token.organizationId as OrganizationId,
        entitlements,
        token.entitlementsOnly,
      ),
    );
  if (token.ownerModel === 'Space' && token.spaceId)
    await permix.setup(
      getSpacePermissions(role, token.spaceId as SpaceId, entitlements, token.entitlementsOnly),
    );
};
