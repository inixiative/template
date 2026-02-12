import type { SpaceId } from '@template/db';
import {
  type Entitlements,
  getSpacePermissions,
  intersectEntitlements,
  lesserRole,
  type Role,
} from '@template/permissions';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';
import { validateRole } from '#/lib/permissions/validateRole';

/**
 * Set up permissions for user's spaces at auth time.
 * Applies token restrictions (lesserRole, intersectEntitlements) if present.
 */
export const setupSpacePermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  const spaceUsers = c.get('spaceUsers');

  // Space token → single space, token permissions only
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

  // SpaceUser token → single space, lesser of spaceUser + token
  if (token?.ownerModel === 'SpaceUser' && token.spaceId) {
    const spaceUser = spaceUsers?.find((su) => su.spaceId === token.spaceId);
    if (spaceUser) {
      await permix.setup(
        getSpacePermissions(
          lesserRole(validateRole(spaceUser.role), validateRole(token.role)),
          token.spaceId as SpaceId,
          intersectEntitlements(spaceUser.entitlements as Entitlements, token.entitlements as Entitlements),
        ),
      );
    }
    return;
  }

  // No space memberships → nothing to set up
  if (!spaceUsers?.length) return;

  // User token or session → all spaces (with token restrictions if present)
  for (const spaceUser of spaceUsers) {
    const spaceId = spaceUser.spaceId as SpaceId;
    const role = token
      ? lesserRole(validateRole(spaceUser.role), validateRole(token.role))
      : validateRole(spaceUser.role);
    const entitlements = token
      ? intersectEntitlements(spaceUser.entitlements as Entitlements, token.entitlements as Entitlements)
      : (spaceUser.entitlements as Entitlements);

    await permix.setup(getSpacePermissions(role, spaceId, entitlements));
  }
};
