/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { OrganizationId } from '@template/db';
import {
  createPermissions,
  type Entitlements,
  getOrgPermissions,
  narrowing,
} from '@template/permissions';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const setupOrgPermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  const orgUsers = c.get('organizationUsers');

  // An organization's own token: the organization holds everything on itself, so the role stands.
  if (token?.ownerModel === 'Organization' && token.organizationId) {
    await permix.setup(
      getOrgPermissions(
        validateRole(token.role),
        token.organizationId as OrganizationId,
        token.entitlements as Entitlements,
      ),
    );
    return;
  }

  if (!orgUsers?.length) return;

  const seats = orgUsers.map((orgUser) =>
    getOrgPermissions(
      validateRole(orgUser.role),
      orgUser.organizationId as OrganizationId,
      orgUser.entitlements as Entitlements,
    ),
  );

  if (!token) {
    await permix.setup(seats);
    return;
  }

  // A token is a narrowing of its holder: a membership's token of that seat, a User token of every
  // seat the person holds. The holder's table owns the claim and the walk caps it live.
  const held =
    token.ownerModel === 'OrganizationUser'
      ? orgUsers.filter((orgUser) => orgUser.organizationId === token.organizationId)
      : orgUsers;
  if (!held.length) return;
  const owner = createPermissions();
  await owner.setup(seats);
  await permix.setup(
    held.map((orgUser) =>
      narrowing(
        'db:organization',
        orgUser.organizationId,
        validateRole(token.role),
        token.entitlements as Entitlements,
        orgUser.entitlements as Entitlements,
      ),
    ),
    { owner },
  );
};
