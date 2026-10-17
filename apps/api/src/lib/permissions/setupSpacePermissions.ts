/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { SpaceId } from '@template/db';
import { capSlice, type Entitlements, getSpacePermissions } from '@template/permissions';
import type { Context } from 'hono';
import { getPrincipalSlice } from '#/lib/permissions/getPrincipalSlice';
import { membershipGrant } from '#/lib/permissions/membershipGrant';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const setupSpacePermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');

  if (token?.ownerModel === 'Space' && token.spaceId) {
    await permix.setup(
      getSpacePermissions(
        validateRole(token.role),
        token.spaceId as SpaceId,
        token.entitlements as Entitlements,
        token.entitlementsOnly,
      ),
    );
    return;
  }

  if (token?.ownerModel === 'Organization') return;

  const spaceUsers =
    token?.ownerModel === 'SpaceUser'
      ? (c.get('spaceUsers') ?? []).filter((su) => su.spaceId === token.spaceId)
      : token?.ownerModel === 'OrganizationUser'
        ? []
        : (c.get('spaceUsers') ?? []);
  const slice = getPrincipalSlice(c);

  for (const spaceUser of spaceUsers) {
    const membership = membershipGrant(spaceUser);
    const grant = slice
      ? capSlice('db:space', membership, slice)
      : { ...membership, entitlementsOnly: false };
    await permix.setup(
      getSpacePermissions(
        grant.role,
        spaceUser.spaceId as SpaceId,
        grant.entitlements,
        grant.entitlementsOnly,
      ),
    );
  }
};
