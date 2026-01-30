import type { SpaceId } from '@template/db';
import {
  type Entitlements,
  OrganizationRole,
  type SpaceRole,
  intersectEntitlements,
  lesserRole,
  setupSpaceContext,
} from '@template/permissions';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

/**
 * Set up permissions for user's spaces at auth time.
 * - Org owners get implicit owner access to all spaces in their org
 * - Explicit SpaceUser memberships grant access per role
 * - Token restrictions (lesserRole, intersectEntitlements) apply when present
 */
export const setupSpacePermissions = async (c: Context<AppEnv>) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const token = c.get('token');
  const orgUsers = c.get('organizationUsers');
  const spaceUsers = c.get('spaceUsers');

  // Track spaces we've already set up (to avoid duplicates from implicit + explicit access)
  const setupSpaceIds = new Set<string>();

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

  // Org owner implicit access: grant owner access to all spaces in owned orgs
  const ownedOrgIds = orgUsers?.filter((ou) => ou.role === OrganizationRole.owner).map((ou) => ou.organizationId) ?? [];

  if (ownedOrgIds.length > 0) {
    const spacesInOwnedOrgs = await db.space.findMany({
      where: {
        organizationId: { in: ownedOrgIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    for (const space of spacesInOwnedOrgs) {
      setupSpaceIds.add(space.id);
      await setupSpaceContext(permix, {
        role: 'owner' as SpaceRole,
        spaceId: space.id as SpaceId,
        entitlements: null,
      });
    }
  }

  // Explicit space memberships
  if (spaceUsers?.length) {
    for (const spaceUser of spaceUsers) {
      // Skip if already set up via org ownership (org owner takes precedence)
      if (setupSpaceIds.has(spaceUser.spaceId)) continue;

      const spaceId = spaceUser.spaceId as SpaceId;
      const role = token
        ? lesserRole(spaceUser.role as SpaceRole, token.role as SpaceRole)
        : (spaceUser.role as SpaceRole);
      const entitlements = token
        ? intersectEntitlements(spaceUser.entitlements as Entitlements, token.entitlements as Entitlements)
        : (spaceUser.entitlements as Entitlements);

      await setupSpaceContext(permix, { role, spaceId, entitlements });
    }
  }
};
