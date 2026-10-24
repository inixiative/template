/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { OrganizationId, SpaceId } from '@template/db';
import {
  createPermissions,
  type Entitlements,
  getOrgPermissions,
  getSpacePermissions,
  narrowing,
} from '@template/permissions';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import type { AppEnv } from '#/types/appEnv';

export const setupSpacePermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  const spaceUsers = c.get('spaceUsers');
  const orgUsers = c.get('organizationUsers');

  // A space's own token: the space holds everything on itself, so the role stands.
  if (token?.ownerModel === 'Space' && token.spaceId) {
    await permix.setup(
      getSpacePermissions(
        validateRole(token.role),
        token.spaceId as SpaceId,
        token.entitlements as Entitlements,
      ),
    );
    return;
  }

  if (!spaceUsers?.length) return;

  const seats = spaceUsers.map((spaceUser) =>
    getSpacePermissions(
      validateRole(spaceUser.role),
      spaceUser.spaceId as SpaceId,
      spaceUser.entitlements as Entitlements,
    ),
  );

  if (!token) {
    await permix.setup(seats);
    return;
  }

  // The holder's table includes the person's organization seats: a space walks to its organization.
  const held =
    token.ownerModel === 'SpaceUser'
      ? spaceUsers.filter((spaceUser) => spaceUser.spaceId === token.spaceId)
      : spaceUsers;
  if (!held.length) return;
  const owner = createPermissions();
  await owner.setup([
    ...seats,
    ...(orgUsers ?? []).map((orgUser) =>
      getOrgPermissions(
        validateRole(orgUser.role),
        orgUser.organizationId as OrganizationId,
        orgUser.entitlements as Entitlements,
      ),
    ),
  ]);
  await permix.setup(
    held.map((spaceUser) =>
      narrowing(
        'db:space',
        spaceUser.spaceId,
        validateRole(token.role),
        token.entitlements as Entitlements,
        spaceUser.entitlements as Entitlements,
      ),
    ),
    { owner },
  );
};
