/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { OrganizationId } from '@template/db';
import { capGrant, type Entitlements, getOrgPermissions } from '@template/permissions';
import type { Context } from 'hono';
import { getPrincipalGrant } from '#/lib/permissions/getPrincipalGrant';
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
  const principalGrant = getPrincipalGrant(c);

  for (const orgUser of orgUsers) {
    const membership = membershipGrant(orgUser);
    const grant = principalGrant
      ? capGrant('db:organization', membership, principalGrant)
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
