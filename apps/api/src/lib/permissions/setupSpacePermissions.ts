import type { SpaceId } from '@template/db';
import {
  type Entitlements,
  type SpaceRole,
  intersectEntitlements,
  lesserRole,
  setupSpaceContext,
} from '@template/permissions';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

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
    await setupSpaceContext(permix, {
      role: token.role as SpaceRole,
      spaceId: token.spaceId as SpaceId,
      entitlements: token.entitlements as Entitlements,
    });
    return;
  }

  // SpaceUser token → single space, lesser of spaceUser + token
  if (token?.ownerModel === 'SpaceUser' && token.spaceId) {
    const spaceUser = spaceUsers?.find((su) => su.spaceId === token.spaceId);
    if (spaceUser) {
      await setupSpaceContext(permix, {
        role: lesserRole(spaceUser.role as SpaceRole, token.role as SpaceRole),
        spaceId: token.spaceId as SpaceId,
        entitlements: intersectEntitlements(
          spaceUser.entitlements as Entitlements,
          token.entitlements as Entitlements,
        ),
      });
    }
    return;
  }

  // No space memberships → nothing to set up
  if (!spaceUsers?.length) return;

  // User token or session → all spaces (with token restrictions if present)
  for (const spaceUser of spaceUsers) {
    const spaceId = spaceUser.spaceId as SpaceId;
    const role = token
      ? lesserRole(spaceUser.role as SpaceRole, token.role as SpaceRole)
      : (spaceUser.role as SpaceRole);
    const entitlements = token
      ? intersectEntitlements(spaceUser.entitlements as Entitlements, token.entitlements as Entitlements)
      : (spaceUser.entitlements as Entitlements);

    await setupSpaceContext(permix, { role, spaceId, entitlements });
  }
};
