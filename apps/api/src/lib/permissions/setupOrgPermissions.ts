/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { OrganizationId } from '@template/db';
import { capSlice, type Entitlements, getOrgPermissions } from '@template/permissions';
import type { Context } from 'hono';
import { getPrincipalSlice } from '#/lib/permissions/getPrincipalSlice';
import { membershipGrant } from '#/lib/permissions/membershipGrant';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const setupOrgPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');

  if (token?.ownerModel === 'Organization' && token.organizationId) {
    await permix.setup(
      getOrgPermissions(
        validateRole(token.role),
        token.organizationId as OrganizationId,
        token.entitlements as Entitlements,
        token.entitlementsOnly,
      ),
    );
    return;
  }

  if (token?.ownerModel === 'Space' || token?.ownerModel === 'SpaceUser') return;

  const orgUsers =
    token?.ownerModel === 'OrganizationUser'
      ? (c.get('organizationUsers') ?? []).filter(
          (ou) => ou.organizationId === token.organizationId,
        )
      : (c.get('organizationUsers') ?? []);
  const slice = getPrincipalSlice(c);

  for (const orgUser of orgUsers) {
    const membership = membershipGrant(orgUser);
    const grant = slice
      ? capSlice('db:organization', membership, slice)
      : { ...membership, entitlementsOnly: false };
    await permix.setup(
      getOrgPermissions(
        grant.role,
        orgUser.organizationId as OrganizationId,
        grant.entitlements,
        grant.entitlementsOnly,
      ),
    );
  }
};
