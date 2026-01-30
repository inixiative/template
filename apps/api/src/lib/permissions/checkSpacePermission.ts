import type { OrganizationId, SpaceId } from '@template/db';
import type { SpaceAction } from '@template/permissions';
import type { Context } from 'hono';
import { cache, cacheKey } from '#/lib/cache/cache';
import type { AppEnv } from '#/types/appEnv';

/**
 * Check if the user has permission to perform an action on a space.
 *
 * Inheritance: If user doesn't have explicit space permission, checks if they
 * own the space's parent organization (org owners have implicit full access).
 *
 * @param c - Hono context
 * @param spaceId - Space to check permission for
 * @param action - Action to check (read, operate, manage, own)
 * @returns true if user has permission
 */
export const checkSpacePermission = async (
  c: Context<AppEnv>,
  spaceId: SpaceId,
  action: SpaceAction,
): Promise<boolean> => {
  const permix = c.get('permix');
  const db = c.get('db');

  // Superadmin bypasses all checks
  if (permix.isSuperadmin()) return true;

  // Check explicit space permission first
  if (permix.check('space', action, spaceId)) {
    return true;
  }

  // Try to get organizationId from stored permission context (avoids DB query)
  const storedContext = permix.getContext('space', spaceId);
  let organizationId = storedContext?.organizationId as OrganizationId | undefined;

  // Fall back to DB lookup if not in context
  if (!organizationId) {
    const space = await cache(
      cacheKey('Space', spaceId, 'id', ['organizationId']),
      () => db.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } }),
      60 * 10, // 10 min cache
    );
    if (!space) return false;
    organizationId = space.organizationId as OrganizationId;
  }

  // Org owners have implicit 'own' permission on all spaces in their org
  return permix.check('organization', 'own', organizationId);
};

/**
 * Require space permission, throwing 403 if not authorized.
 */
export const requireSpacePermission = async (
  c: Context<AppEnv>,
  spaceId: SpaceId,
  action: SpaceAction,
): Promise<void> => {
  const hasPermission = await checkSpacePermission(c, spaceId, action);
  if (!hasPermission) {
    const { HTTPException } = await import('hono/http-exception');
    throw new HTTPException(403, { message: `Space permission denied: ${action}` });
  }
};
