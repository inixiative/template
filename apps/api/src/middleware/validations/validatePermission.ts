import type { AccessorName } from '@template/db';
import { db, hydrate } from '@template/db';
import type { Action } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

/**
 * Unified permission middleware using ReBAC.
 *
 * Hydrates the resource with relations needed for permission traversal,
 * then checks via ReBAC schema (handles superadmin, direct perms, delegation).
 *
 * @example
 * .use(validatePermission('read'))   // check 'read' on loaded resource
 * .use(validatePermission('manage')) // check 'manage' on loaded resource
 */
export const validatePermission = makeMiddleware<Action>((action) => async (c, next) => {
  const resource = c.get('resource');
  const resourceType = c.get('resourceType') as AccessorName | undefined;
  const permix = c.get('permix');

  // No resource loaded = nothing to check (let route handle it)
  if (!resource || !resourceType) return next();

  // Hydrate with relations for ReBAC traversal (org → space, etc.)
  const hydrated = await hydrate(db, resourceType, resource as { id: string });

  if (!check(permix, rebacSchema, resourceType, hydrated, action)) {
    throw makeError({ status: 403, message: 'Access denied', requestId: c.get('requestId') });
  }

  await next();
});
